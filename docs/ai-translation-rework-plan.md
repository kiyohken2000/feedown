# AI 設定リファクタ + Hy-MT2 翻訳実装計画

「Phase E/F 検証で確定した方針」を本実装に落とすための作業計画兼進捗管理表。
判断の根拠は `docs/llama-rn-post-merge-plan.md` の Phase E/F セクション。

---

## ゴール

1. **AI 関連の設定を Profile から独立画面に切り出す** (Profile が長くなりすぎ)
2. **翻訳機能を Hy-MT2 1.8B (llama.rn) に切り替える** (LFM2.5 1.2B は段落崩壊・情報欠落の品質問題、Phase E)
3. **全文翻訳に対応** (現状 2500 字キャップを撤廃、チャンク分割 + プログレッシブ表示)

非ゴール: 要約 / signal / chat / TTS の汎用 LLM パスは executorch + LFM2.5 のまま (Phase F で executorch が 55% 速いと確定)。

---

## 確定済みの設計判断

| # | 項目 | 決定 |
|---|------|------|
| 1 | エンジンスワップの配置 | `AiContext` に orchestrator を置く (`runWithLlamaRn`) |
| 2 | 翻訳長キャップ | **撤廃 (全文)** + チャンク分割 (~2500字/chunk、~600 tok 入力) |
| 3 | LFM2.5 再ロード | lazy (次の summary/chat 要求時) |
| 4 | 失敗時 fallback | 無し (明示エラー、自動 LFM2.5 fallback はしない) |
| 5 | rollout | Profile トグル (default OFF、graceful upgrade)、experimental flag は使わない |
| 6 | AI 設定画面 | 新規 Stack 画面 `AiSettings` に集約、Profile からはリンク 1 行 |

---

## アーキテクチャ

### 状態遷移 (翻訳要求時)

```
[idle: executorch LFM2.5 loaded]
   │ translate(article) 呼び出し
   ▼
[swap-out: LFM2.5 unload (preventLoad=true → controller.delete)]
   │ Metal release 待ち (~200-500ms)
   ▼
[llama-init: initLlama(Hy-MT2 GGUF)]
   │ 成功
   ▼
[chunk loop: for each chunk in chunks]
   │   ctx.completion(buildHyMt2TranslationMessages(chunk, lang))
   │   → 完了 chunk を即 UI 反映
   │   → cancel チェック (cancelled → break)
   ▼
[llama-release: ctx.release / releaseAllLlama]
   │
   ▼
[idle: LFM2.5 は lazy reload (次の executorch 要求時)]
```

### チャンク分割ロジック

- 入力: `article.contentText` の段落配列 (`\n\n` split)
- 目標 chunk サイズ: **~2500 EN 字 (≈600 tok 入力)**
- アルゴリズム: 段落を順に積み上げ、累計が 2500 字超えたら chunk 確定、次の段落から新 chunk
- 1 段落が 2500 字を超える場合: 文単位 (`。` / `.`) で再分割
- 出力: `Array<{ text: string, paragraphIndices: number[] }>`

### キャッシュ

- キー: `articleId + contentHash + 'hy-mt2-q4_k_m' + targetLang`
- chunk 単位の中間キャッシュは持たない (全文翻訳結果を 1 件で保存)
- LFM2.5 翻訳結果との互換性は無い (キーが違うので自動 invalidate)

---

## Stage A: AI 設定画面の切り出し (機能変更ゼロのリファクタ)

回帰リスクが低いので先に出して動作確認する。

### A-1: 新規画面 `AiSettings.js` 作成

- ファイル: `apps/mobile/src/scenes/profile/AiSettings.js` (または `apps/mobile/src/scenes/ai/AiSettings.js` 新規ディレクトリ)
- Stack スクリーンとして登録 (`Router.js` に追加)
- ヘッダー: 「On-Device AI」、戻るボタン

### A-2: Profile から AI セクションを移植

- Profile.js の以下を AiSettings.js に移動:
  - AI 機能 ON/OFF トグル
  - executorch モデル選択
  - DL 進捗 / 「使用中」表示
  - 出力言語選択
  - 翻訳トグル (現存するなら)
- Profile.js には「On-Device AI ›」のナビゲーションリンク 1 行のみ残す

### A-3: 動作確認

- Profile → On-Device AI 遷移、戻る、設定変更がすべて保持される
- AsyncStorage キーは変更しない (同じ設定が同じ状態で読まれる)

### Stage A 完了の commit

```
refactor(profile): split AI settings into dedicated AiSettings screen
```

---

## Stage B: Hy-MT2 翻訳パス実装

### B-1: `AiContext.runWithLlamaRn` orchestrator

- ファイル: `apps/mobile/src/contexts/AiContext.js`
- 新規 API: `async runWithLlamaRn({ model, onChunkStart, onCompletion, signal })`
- 実装:
  1. `setLlamaActive(true)` → `preventLoad: true` で executorch unload triggered
  2. 200-500ms 待機 (Metal release 確実化)
  3. `initLlama({ model: gguf_path, ...sampling })` → ctx
  4. `onCompletion(ctx)` コールバックで chunk loop は呼び元 (`useArticleTranslation`) に渡す
  5. `ctx.release()` または `releaseAllLlama()`
  6. `setLlamaActive(false)` → preventLoad: false (lazy reload は次の executorch 要求まで遅延)
- 並行制御: `isLlamaActive` state で重複呼び出しを reject

### B-2: `buildHyMt2TranslationMessages` + chunk 分割

- ファイル: `apps/mobile/src/ai/prompts.js`
- 追加:

```js
export function buildHyMt2TranslationMessages(plainText, targetLanguage) {
  const langName = getLanguageName(targetLanguage)
  return [
    {
      role: 'user',
      content: `Translate the following text into ${langName}. Note that you should **only output the translated result without any additional explanation**:\n\n${plainText}`,
    },
  ]
}
```

- ファイル: `apps/mobile/src/ai/translationChunks.js` (新規)
- `splitParagraphsIntoChunks(paragraphs, targetCharsPerChunk = 2500)` を export

### B-3: `useArticleTranslation` を Hy-MT2 chunk path に書き換え

- ファイル: `apps/mobile/src/ai/useArticleTranslation.js`
- 既存の `limitParagraphsForTranslation` (2500 字キャップ) を撤廃
- 新しい state:
  - `translatedChunks: string[]` (完了した chunk の翻訳結果、プログレッシブ表示用)
  - `progress: { current: number, total: number }`
  - `cancelRequested: boolean`
- フロー:
  1. キャッシュ確認 → ヒットなら全文セット、終了
  2. `ai.runWithLlamaRn({ model: HY_MT2_MODEL, onCompletion: async (ctx) => { ... } })`
  3. onCompletion 内で chunk ループ、各 chunk の completion 結果を `setTranslatedChunks(prev => [...prev, chunkResult])`
  4. 全 chunk 完了後にキャッシュ保存
- cancel API: `cancelTranslation()` を呼ぶと次の chunk 開始前に break、部分結果は保持

### B-4: AiSettings に Hy-MT2 トグル + DL UI

- ファイル: `apps/mobile/src/scenes/profile/AiSettings.js`
- 追加項目:
  - 「翻訳特化モデルを使用 (Hy-MT2 1.8B, 1.13GB)」トグル
  - DL 状況 (PoC の `downloadModel` を流用)
  - RAM ゲート: 3.5GB 未満端末ではトグルを disable + 説明
- トグル ON 時のフロー:
  - 未 DL → 自動で DL 開始
  - DL 中 → 進捗表示
  - DL 完了 → `settings.useSpecializedTranslation = true` を AsyncStorage に保存

### B-5: 翻訳 path のルーティング分岐

- `useArticleTranslation` の中で:
  - `settings.useSpecializedTranslation === true && Hy-MT2 DL 済み` → Hy-MT2 path
  - それ以外 → 既存 LFM2.5 path (現行コードのまま)
- 既存ユーザの動作は変わらない (トグル OFF が default)

### B-6: キャッシュキー更新

- ファイル: `apps/mobile/src/ai/translationCache.js` (該当ファイル名を確認)
- キーに翻訳エンジン ID を含める: `articleId:contentHash:engineId:targetLang`
- engineId: `'lfm2-5-1-2b'` (現行) または `'hy-mt2-1-8b-q4-k-m'` (新規)

### B-7: ArticleAi UI の進捗表示対応

- ファイル: `apps/mobile/src/components/article/ArticleAiPanel.js` (該当を確認)
- 翻訳中の表示を「単一スピナー」→「翻訳済み段落の逐次表示 + 残り chunk 数 + cancel ボタン」に拡張
- 完了済み chunk は `translatedChunks` 配列から段階表示

---

## Stage C: 動作確認 + 計測

### C-1: iPhone 13 mini (A15/4GB) 実機確認

- Profile → AiSettings 遷移、翻訳特化モデルトグル ON → DL → 翻訳実行
- 想定: LFM2.5 unload → Hy-MT2 init (~2.3s) → chunk ごとに ~45s → release → 完了
- 計測: 全 chunk 完了時間、UI 反応性、cancel 動作

### C-2: 中・長文記事での品質確認

- 5,000 字記事、10,000 字記事、15,000 字記事の 3 段階で翻訳実行
- 段落構造保持、情報欠落の有無、自然な日本語かを目視確認
- LFM2.5 path との比較 (トグル OFF/ON で同じ記事を翻訳して並べる)

### C-3: 失敗ケース確認

- 翻訳中に画面離脱 → 部分結果がキャッシュされず破棄されること
- 翻訳中に cancel → 部分結果が UI に残ること
- Hy-MT2 init 失敗 (DL 破損ケース) → 明示エラー表示、自動 fallback しない

---

## 進捗管理表

更新ルール: 着手時に `[ ]` → `[~]`、完了時に `[x]` + 完了日時 + commit hash。

### Stage A: AI 設定画面の切り出し

- [ ] A-1: 新規画面 `AiSettings.js` 作成 + Router 登録
- [ ] A-2: Profile から AI セクションを AiSettings へ移植
- [ ] A-3: 動作確認 (遷移 / 設定保持)
- [ ] Stage A commit

### Stage B: Hy-MT2 翻訳パス実装

- [ ] B-1: `AiContext.runWithLlamaRn` orchestrator
- [ ] B-2: `buildHyMt2TranslationMessages` + `splitParagraphsIntoChunks`
- [ ] B-3: `useArticleTranslation` を Hy-MT2 chunk path に書き換え (progressive + cancel)
- [ ] B-4: AiSettings に Hy-MT2 トグル + DL UI
- [ ] B-5: 翻訳 path のルーティング分岐 (default OFF, opt-in)
- [ ] B-6: キャッシュキーに engineId を追加
- [ ] B-7: ArticleAi UI の chunk 逐次表示 + cancel ボタン

### Stage C: 動作確認 + 計測

- [ ] C-1: iPhone 13 mini (A15/4GB) 実機での全体動作確認
- [ ] C-2: 5k / 10k / 15k 字記事での品質確認 (LFM2.5 path との比較含む)
- [ ] C-3: 失敗ケース確認 (画面離脱 / cancel / init 失敗)

### リリース

- [ ] PoC ブランチ `poc/llama-rn-gemma4` の差分を整理 → main に merge する PR を作成
- [ ] llama.rn (0.12.4 pin) を本番依存に格上げ (現状 PoC 限定)
- [ ] App Store 申請ノートに「翻訳特化モデル (オプション、1.13GB DL)」を記載

---

## オープン課題 / リスク

| 課題 | 影響 | 暫定対応 |
|------|------|----------|
| iOS Metal cold compile flakiness (Phase B で観測、初回 ~13s) | Hy-MT2 初回 init が稀に失敗 | エラー時はリトライ promo を出す。precompiled metallib 対応は upstream 課題 |
| 4GB 端末 (iPhone 13 mini) で Hy-MT2 init 時に LFM2.5 unload が遅延 | jetsam OOM 可能性 | swap 間に意図的 200-500ms delay、`getBackendDevicesInfo` で working set を pre-check |
| chunk 境界での文脈断絶 | 段落をまたぐ参照の翻訳が不自然になる可能性 | chunk サイズ 2500 字は段落を 1 つは含むサイズ。1 段落 = 1 chunk になるよう優先する |
| Hy-MT2 DL の中断・再開 | 1.13GB DL 失敗時に半端な状態が残る | PoC の resumable DL を流用 (`downloadModel` の Range request 対応) |
| Profile → AiSettings 遷移で既存 deep link が壊れないか | 既存ユーザが「Profile の AI 設定」をブックマークしている可能性 (低) | ない (Profile はメインタブ、AI 設定は内部画面、deep link 仕様なし) |
| Android (#229 系) | 未検証 | iOS 優先で進める。Android は Phase C と同様、優先度低で保留 |

---

## 関連ドキュメント

- `docs/MOBILE_ON_DEVICE_AI_PLAN.md` — executorch 本体計画 (Phase 1-6 完了、Phase 4 翻訳セクションは本計画で書き直す)
- `docs/llama-rn-post-merge-plan.md` — Phase E/F の検証根拠と判断履歴
- `apps/mobile/src/ai/llamaRnPoC.js` — RAM ゲート / Hy-MT2 init / DL の参考実装
- `apps/mobile/src/components/llama/LlamaPocCard.js` — DL UI / RAM ゲート UI の参考実装
