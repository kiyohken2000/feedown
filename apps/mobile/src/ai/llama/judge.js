// SemIf 方式の意味分類 (1 トークン生成 + ラベル確率読み) を llama.rn で行う。
// 背景と API 確認は _temp/HANDOFF_llama_rn_semif.md §1-3。
//
// - n_predict: 1 で選択肢の記号 (A / B) を 1 トークンだけ生成させ、n_probs の
//   確率からラベルだけ取り出して正規化する。生成テキストはパースしない
// - llama.rn の n_probs は「サンプラ適用後」の確率 (cpp/rn-completion.cpp) なので
//   temperature は 1 固定、top_k / top_p / min_p の切り捨ても全部切る。
//   デフォルト (top_k 40 / top_p 0.95 / min_p 0.05) のままだと弱い側のラベルが
//   0 に落ちて人工的に飽和する (iPhone 13 mini 実測: A 0.6147 / B 0.3853 が
//   ちょうど 1.0 に足し上がっていた = 切り捨て後の再正規化)
// - logit_bias は使わない。llama.rn 0.12.4 (main も) の JSIParams.cpp が
//   std::vector<llama_logit_bias> を token ID で添字アクセスしており、渡すと
//   OOB 書き込みでネイティブクラッシュする (iPhone 13 mini で再現済み)
// - completion_probabilities は末尾の要素を読む。llama.rn (0.12.4 / main) は
//   非並列 completion の generated_token_probs を completion 間で clear しない
//   ので、[0] は「この ctx で最初に n_probs 付きで生成したトークン」の確率が
//   ずっと返る (iPhone 13 mini で 4 モデル全件同一確率として再現)。n_predict 1
//   なら毎回ちょうど 1 要素追記されるので末尾 = 今回分
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

// 切り捨て無し: probs を素の softmax (temperature 1) に近づける
export const JUDGE_FULL_DIST = { top_k: 0, top_p: 1.0, min_p: 0.0, typical_p: 1.0 }

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
//   probs   top-N の上位 5 件 (tok_str, prob) — サンプラ設定の比較用
//   ms      completion 往復時間
//   promptN / cacheN  prefill したトークン数 / KV cache から再利用した数
// sampling: JUDGE_FULL_DIST (既定) か、比較用に llama.cpp 既定の切り捨て
// ({} を渡す) を選べる
export async function judge(
  ctx,
  {
    system,
    rule,
    body,
    withGrammar = true,
    sampling = JUDGE_FULL_DIST,
    nProbs = 20,
  },
) {
  await prepareJudge(ctx)
  const params = {
    messages: buildJudgeMessages({ system, rule, body }),
    n_predict: 1,
    temperature: 1,
    n_probs: nProbs,
    enable_thinking: false,
    ...sampling,
  }
  if (withGrammar) params.grammar = LABEL_GRAMMAR

  const start = now()
  const res = await ctx.completion(params)
  const ms = now() - start

  const all = res?.completion_probabilities ?? []
  const probs = all.length > 0 ? all[all.length - 1]?.probs ?? [] : []
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
