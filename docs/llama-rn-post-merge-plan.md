# llama.rn 移行 — リリース後の実行計画

PR [#349](https://github.com/mybigday/llama.rn/pull/349) (iOS Metal embed fix) は **2026-05-25 に upstream `mybigday/llama.rn` へ merge 済み**。
ただし merge 時点の最新リリースは **v0.12.3 (2026-05-21)** で、#349 はまだ npm に出ていない。

このドキュメントは「#349 を含む npm リリースが出た後」に実行する作業計画。リリースが出るまでは着手しない (git 参照での前倒しはしない方針)。

関連: `docs/MOBILE_ON_DEVICE_AI_PLAN.md` (executorch ベースの本体計画 / 現行 production)、`docs/llama-rn-pr-drafts/` (#349 の draft 一式)。

---

## ゴール

**executorch (現行 Phase 1–6) → llama.rn (GGUF) へ全面移行すべきか** を、iOS / Android 両方の実機ベンチで判断する。

移行の動機 (変わらず):
- GGUF エコシステムの広さ (Gemma 4 E2B / 翻訳特化モデルなど、`.pte` に無いモデル)
- 量子化レベルの自由度 (1.25bit〜8bit)
- 新モデルへの追随速度

判断は **GO / NO-GO / 部分採用** の 3 択。executorch を捨てる前提ではなく、データで決める。

---

## トリガー条件 (これが満たされたら開始)

1. `npm view llama.rn version` が **v0.12.3 より新しい** (0.12.4 / 0.13.0 等) を返す
2. そのリリースの changelog / commit に **#349 (embed ggml-metal source) が含まれている** ことを確認
   - 確認できない場合は `npm view llama.rn@<新version> ...` で `cpp/ggml-metal/ggml-metal-embed.s` 同梱を確認するか、リリースの diff を見る

→ 両方満たすまで待機。出たか時々 `npm view llama.rn version` で確認するだけでよい。

---

## フェーズ A — PoC ブランチを npm 正式版へ戻す (≈30 分, iOS)

`poc/llama-rn-gemma4` は #349 検証時に `llama.rn` を local fork (`file:../../../llama.rn`) 参照にしている可能性がある。これを npm 版へ戻す。

1. `git checkout poc/llama-rn-gemma4`
2. `apps/mobile/package.json` の `llama.rn` を新リリースの固定バージョン (例 `"llama.rn": "0.12.4"`) に変更
3. `yarn install`
4. dev client 再ビルド (iOS, A15 実機 = iPhone 13 mini で検証)
   - `cd apps/mobile && eas build --profile development --platform ios` もしくは local prebuild → `expo run:ios --device`
5. Profile → Llama.rn PoC を開き、`enableNativeLog` ON

**期待**: ネイティブログに `using embedded metal library` が出て、#348 の `default.metallib not found … XPC_ERROR_CONNECTION_INTERRUPTED` が出ない。
→ ここで npm 版に fix が正しく入っていることを実機確認できる。出なければフェーズ B 以降に進まず、まず npm 版の問題を切り分ける。

---

## フェーズ B — iOS 機能 & 性能ベンチ (≈半日, A15 実機)

PoC の診断ツール (`apps/mobile/src/ai/llamaRnPoC.js`) をそのまま使う。揃っている関数:

| 関数 | 用途 |
|------|------|
| `enableNativeLog` / `disableNativeLog` | llama.cpp 内部ログ取得 |
| `probeBackends` | 利用可能 GPU backend 情報 |
| `probeModelInfo` | GGUF メタ情報 (init 前のファイル読めるか) |
| `downloadModel` | resumable DL + 進捗 |
| `verifyModelIntegrity` | サイズ / GGUF magic 検証 |
| `runBenchmark` | init → completion → release。`{ loadMs, generateMs, tokensPerSec, tokenCount, gpuLayersUsed }` を返す |
| `diagNativeModule` | ネイティブモジュールがリンクされているか |

検証対象モデル (`POC_MODELS`):
- **Qwen3 0.6B Q4_K_M** (~460MB) — sanity。まずこれが通ること
- **Gemma 4 E2B-it Q4_K_M** (~3.11GB, multimodal) — PoC 本命。A15 のメモリ working-set 上限に当たる可能性は既知 (これは #349 とは別問題)

取る数値 (各モデル):
1. **load 時間** (`loadMs`) — モデルファイル → 推論可能まで
2. **生成速度** (`tokensPerSec`) — 固定プロンプト (`BENCH_MESSAGES`) での tok/s
3. **GPU offload** (`gpuLayersUsed`) — Metal に何層乗ったか
4. **メモリ** — Xcode Instruments か実機の挙動 (OOM / kill されないか)
5. **要約品質** — `BENCH_MESSAGES` の日本語 2 文要約が実用レベルか (主観評価でよい)

**iOS 合格ライン (暫定)**:
- Qwen3 0.6B が A15 で確実に load + 生成できる
- tok/s が executorch の Qwen3 / LFM2.5 と比較して許容範囲 (大幅に遅くない)
- Gemma 4 E2B が load できるか、できないならメモリ要件を明文化 (= 対応端末を絞る判断材料)

---

## フェーズ C — Android 実機検証 (≈半日〜1 日, Android 実機)

**重要**: Android は #348 と等価な「source 同梱漏れ」バグは持たない。OpenCL kernel は llama.rn ビルド時に `embed_kernel.py` + `-DLM_GGML_OPENCL_EMBED_KERNELS` で `.so` に焼き込み済み。よって #349 のような fix は不要。

ただし **別軸の GPU リスクがある** ため、実機検証は必須:
- upstream issue [#229](https://github.com/mybigday/llama.rn/issues/229) — Adreno 740 (Snapdragon 8 Gen 2 / Galaxy S23 Ultra) で OpenCL backend が context init 中に SIGABRT。`cache_type_k/v: "q8_0"` が疑われている
- 回避策候補: KV cache を `f16` にする / `n_gpu_layers: 0` で CPU only に落とす

検証手順:
1. PoC ブランチで Android dev client ビルド
2. 手元の Android 実機 (GPU チップを記録: Adreno / Mali / Xclipse) で同じ `runBenchmark` を実行
3. **まず OpenCL (`n_gpu_layers > 0`) で #229 系の crash が出ないか確認**
   - 出る場合: KV cache を `f16` に変えて再試行 → それでもダメなら CPU only での tok/s を記録
4. iOS と同じく load 時間 / tok/s / メモリ / 要約品質を取る

**Android 合格ライン (暫定)**:
- 少なくとも CPU path で安定動作 (crash しない)
- GPU path が手元の実機で動くなら tok/s を記録、動かないなら「GPU は端末依存」と明記
- crash する場合、それが回避可能 (cache type / gpu layers) か、ブロッカーかを切り分け

---

## フェーズ D — executorch との横並び比較 (≈半日)

現行 production (executorch Phase 1–6) と llama.rn を同条件で並べる。比較表を作る:

| 項目 | executorch (現行) | llama.rn (候補) |
|------|------------------|-----------------|
| iOS load 時間 | | |
| iOS tok/s | | |
| Android load 時間 | | |
| Android tok/s | | |
| メモリピーク | | |
| 対応モデル数 / 入手性 | `.pte` のみ | GGUF 全般 |
| 量子化の自由度 | 限定的 | 1.25–8bit |
| iOS 安定性 | 実績あり (Phase 1–6 稼働) | #349 後に要実績 |
| Android 安定性 | 実績あり | #229 系リスク |
| multimodal | △ | ○ (Gemma 4) |
| 実装移行コスト | 0 (現状維持) | `src/ai/` 全面書き換え |

executorch 側の数値は現行アプリ (本体ブランチ) で同じプロンプトを流して取る。

---

## GO / NO-GO 判断マトリクス

フェーズ B–D の結果で決める。

**GO (全面移行)** の条件:
- iOS / Android 両方で安定動作 (crash 無し or 回避策が許容範囲)
- tok/s・load が executorch と同等以上、または「GGUF の選択肢の広さ」がその差を上回る価値がある
- Gemma 4 などの GGUF only モデルに実利用価値が見えている

**部分採用** の条件:
- iOS は良好だが Android に #229 系ブロッカーが残る → iOS だけ llama.rn、Android は executorch 継続 (2 バックエンド保持はコスト高なので慎重に)
- あるいは特定モデル用途 (翻訳特化 GGUF 等) のみ llama.rn を追加し、要約は executorch 維持

**NO-GO (executorch 継続)** の条件:
- 性能が executorch に明確に劣る
- Android crash が回避不能
- GGUF の自由度が現行ユーザー体験に具体的メリットを生まない

→ 判断は「GGUF で何ができるようになるか」が「2 バックエンド分の保守コスト or 全面書き換えコスト」に見合うかで決める。データが出るまで結論を出さない。

---

## GO になった場合の移行スコープ (概要のみ、詳細は別途)

`docs/MOBILE_ON_DEVICE_AI_PLAN.md` の executorch 実装 (`src/ai/`, `AiContext`, `useArticleAi` 等) を llama.rn API へ置換:
- `useLLM` (executorch) → llama.rn の `initLlama` / `ctx.completion` ベースのフックへ
- モデル定義 (`models.js`) を `.pte` 定数から GGUF URL + ローカルパス管理へ
- ダウンロード/キャッシュ層は PoC の `downloadModel` (resumable) が流用可能
- Phase 1–6 の機能 (要約 / signal 分離 / chat / TTS / 翻訳) を順次移植。TTS は executorch 非依存なので影響小

移行は機能単位で段階的に。一気に全部切り替えない。

---

## リスク / open questions

- **npm リリースに #349 が確実に入るか** — merge されても次リリースでスキップされる可能性は低いが、trigger 条件 2 で必ず確認する
- **Gemma 4 E2B の A15 メモリ** — #349 とは独立した working-set 上限問題。load できないなら対応端末を絞るか軽量モデルにする
- **Android #229** — 手元の実機が Adreno でないなら再現しない可能性。逆に再現しても回避策が効くか未確認
- **flag-gating** — #349 は embed path を unconditional にした。maintainer が後で env flag 化したら podspec/CMake の挙動が変わる可能性 (リリース版で要確認)
- **2 バックエンド保守** — 部分採用は魅力的に見えるが executorch + llama.rn 両持ちは保守コストが倍。安易に選ばない

---

## チェックリスト (リリース検知後に上から実行)

- [x] `npm view llama.rn version` が v0.12.3 超え、かつ #349 含有を確認 → **0.12.4 (2026-05-25)、embed.s 同梱を確認**
- [x] フェーズ A: PoC を npm 版に戻して iOS A15 で embed ログ確認 → **`using embedded metal library` 確認**
- [x] フェーズ B: iOS で Qwen3 0.6B / Gemma 4 E2B のベンチ取得 → **Qwen3 37.6 tok/s、Gemma は OOM**
- [ ] フェーズ C: Android 実機で同ベンチ + #229 系 crash 有無 → **未実施 (下記の判断により優先度低)**
- [x] フェーズ D: executorch と横並び比較表を埋める → **executorch 44.0 tok/s > llama 37.6**
- [x] GO / NO-GO / 部分採用を判断、結論をこのドキュメント末尾に追記 → **下記**

---

## 実行結果と最終判断 (2026-05-25)

`poc/llama-rn-gemma4` を `llama.rn@0.12.4` に pin、**EAS development build を Windows からクラウド投入**して iPhone 13 mini (A15, iOS 26.5) で検証した。

### 実測値 (iOS A15/4GB, Qwen3 0.6B, 同一プロンプト・同一サンプリング)

| 指標 | llama.rn Q4_K_M | executorch quantized |
|------|----------------|----------------------|
| **tok/s** | 37.6 | **44.0** (≈17%速い) |
| generateMs | 6782 | 4088 |
| loadMs | 879 (Metal キャッシュ後 warm) | 12616 (DL 後 cold、比較不可) |

### 主要な発見

1. **#349 は 0.12.4 で実機動作する**。`using embedded metal library` が出て A15 でロード可能になった。ただし **cold Metal compile が初回のみ flaky** — `[device newLibraryWithSource:]` の実行時シェーダコンパイルが XPC 経由で、初回は ~13秒かつ `XPC_ERROR_CONNECTION_INTERRUPTED` で中断することがある。**一度通れば OS がキャッシュ**して以降 52ms で安定。production としては「初回起動で失敗→リトライ/再起動」が起こりうる弱点。本筋の堅牢化は precompiled `default.metallib` 同梱 (= #252 が捨てた方式)。

2. **Gemma 4 E2B は 4GB iPhone に載らない (OOM 確定)**。Q4_K_M (3.11GB) / Q3_K_M (2.54GB) / UD-Q2_K_XL (2.40GB) すべて jetsam kill。Q3/Q2 は GPU working-set 内に収まるのにクラッシュ = プロセス全体メモリの壁。executorch の同居を外しても確保数字は不変だったので **backend 非依存・端末 RAM の物理的な壁**。→ 移行の主動機だった「multimodal GGUF を on-device」は 4GB 端末では実現不可。

3. **同じ小型モデルで executorch の方が速い** (44.0 vs 37.6 tok/s)。

### 判断: **NO-GO (executorch 継続)**

- 速度で executorch が上 + 現行 production で実績あり + 移行コスト0
- llama.rn は cold compile flakiness を新たに抱える
- GGUF の目玉 (Gemma 4 E2B 等の大型/multimodal) は対象端末 (4GB) で動かず、移行の主動機が消えた
- フェーズ C (Android #229) は未実施だが、iOS がこの結論かつ executorch は Android も実績ありのため、全面移行を覆す材料にはなりにくい → 優先度を下げて保留

**llama.rn / GGUF の残る使い所**: executorch に無い特定 GGUF only モデル (翻訳特化等) がどうしても必要になった将来、選択肢として `poc/llama-rn-gemma4` ブランチを温存する。今すぐ全面移行する理由はない。

**upstream 貢献の価値**: #348/#349 で A15 の GGUF ロードを「動く」ところまで到達させ merge もされた。移行は見送るが、この成果自体は無駄ではない。
