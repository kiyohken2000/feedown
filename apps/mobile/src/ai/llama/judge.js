// SemIf 方式の意味分類 (1 トークン生成 + ラベル確率読み) を llama.rn で行う。
// 背景と API 確認は _temp/HANDOFF_llama_rn_semif.md §1-3。
//
// - n_predict: 1 で選択肢の記号 (A / B) を 1 トークンだけ生成させ、n_probs の
//   確率からラベルだけ取り出して正規化する。生成テキストはパースしない
// - llama.rn の n_probs は「サンプラ適用後」の確率 (cpp/rn-completion.cpp) なので
//   temperature は 1 固定、logit_bias は A/B に同値でかける (片方だけだと比が崩れる)
// - grammar で A/B 以外を落とすと probs は実質 2 要素になるが、有無どちらでも
//   安全なように pA / (pA + pB) で正規化する
// - system + rule を固定して body を user ターン末尾に置く並びにしておくと、
//   transformer モデルでは prefix が KV cache から再利用される。hybrid
//   (Qwen3.5 / LFM2) は 0.12.4 だと全 prefill し直し (0.12.7 で対応)。
//   timings.cache_n を結果に残すのはその確認のため

export const JUDGE_LABELS = ['A', 'B']
const LABEL_GRAMMAR = `root ::= ${JUDGE_LABELS.map((l) => `"${l}"`).join(
  ' | ',
)}`
const LABEL_BIAS = 100

function now() {
  return typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now()
}

// ctx ごとにラベルの token ID を 1 回だけ解決する。ラベルが 1 トークンで
// ないモデル (日本語ラベルなど) は SemIf 方式が成立しないので早期に落とす。
const labelIdCache = new WeakMap()

export async function prepareJudge(ctx) {
  const cached = labelIdCache.get(ctx)
  if (cached) return cached
  const ids = {}
  for (const label of JUDGE_LABELS) {
    const { tokens } = await ctx.tokenize(label)
    if (!tokens || tokens.length !== 1) {
      throw new Error(
        `judge label "${label}" is not a single token (${tokens?.length ?? 0})`,
      )
    }
    ids[label] = tokens[0]
  }
  labelIdCache.set(ctx, ids)
  return ids
}

export function buildJudgeMessages({ system, rule, body }) {
  return [
    { role: 'system', content: system },
    {
      role: 'user',
      content:
        `ルール:\n${rule}\n\nレス:\n${body}\n\n` +
        `選択肢:\nA. ルールに該当する\nB. ルールに該当しない\n\n` +
        `選択肢の記号を A か B の 1 文字だけで答えてください。`,
    },
  ]
}

// 戻り値:
//   p       P(A) をラベルだけで正規化した値。ラベルが top-N に無ければ NaN
//   pA, pB  正規化前の prob (grammar 有りなら合計 ≈ 1)
//   text    実際に生成された 1 トークン (grammar 無し時の確認用)
//   probs   top-N の上位 5 件 (tok_str, prob) — logit_bias 有無の比較用
//   ms      completion 往復時間
//   promptN / cacheN  prefill したトークン数 / KV cache から再利用した数
export async function judge(
  ctx,
  { system, rule, body, withGrammar = true, withBias = true, nProbs = 20 },
) {
  const ids = await prepareJudge(ctx)
  const params = {
    messages: buildJudgeMessages({ system, rule, body }),
    n_predict: 1,
    temperature: 1,
    n_probs: nProbs,
    enable_thinking: false,
  }
  if (withGrammar) params.grammar = LABEL_GRAMMAR
  if (withBias)
    params.logit_bias = JUDGE_LABELS.map((l) => [ids[l], LABEL_BIAS])

  const start = now()
  const res = await ctx.completion(params)
  const ms = now() - start

  const probs = res?.completion_probabilities?.[0]?.probs ?? []
  const probOf = (label) => probs.find((p) => p.tok_str === label)?.prob ?? 0
  const pA = probOf('A')
  const pB = probOf('B')
  const sum = pA + pB
  return {
    p: sum > 0 ? pA / sum : NaN,
    pA,
    pB,
    text: res?.text ?? '',
    probs: probs.slice(0, 5).map((x) => ({ tok_str: x.tok_str, prob: x.prob })),
    ms,
    promptN: res?.timings?.prompt_n ?? null,
    cacheN: res?.timings?.cache_n ?? null,
  }
}
