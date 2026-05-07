# モバイル版オンデバイスAI実装計画

## 目的

`react-native-executorch` を使い、FeedOwn のモバイルアプリにプライバシー重視のAI読書支援機能を追加する。

最初に対象にする機能は次の4つ。

1. 視点切り替え要約
2. 記事の信号分離
3. 記事チャット
4. 記事読み上げ

FeedOwn を汎用チャットAIアプリにすることが目的ではない。目的は、記事本文・読書履歴・関心情報を端末外に送らずに、読む負担を減らすこと。

## 背景

`react-native-executorch` は、Meta の ExecuTorch を使って React Native アプリ内でAIモデルをローカル実行するためのライブラリ。FeedOwn の "Own your feeds, own your data" という方向性と相性が良い。

重要な制約:

- React Native New Architecture が必要。
- 対応OSは iOS 17 以上、Android 13 以上。
- LLM 系機能はメモリとストレージを多く使う。
- 初期リリースではモバイル限定の実験機能として扱う。
- AI出力は記事ごとにローカルキャッシュし、同じ記事で毎回再生成しない。

## 機能1: 視点切り替え要約

同じ記事を、複数の読み方で要約できるようにする。単なる汎用要約ではなく、RSS記事に含まれる事実・意見・宣伝・技術的影響を読み分けやすくする。

### 初期の視点

- `brief`: 短く中立的な要約。
- `technical`: 実装、仕様、依存関係、互換性、リスクを中心にした要約。
- `critical`: 根拠が弱い点、誇張、未検証の主張、欠けている文脈を抽出。
- `impact`: ユーザーのプロジェクトや作業への実務的影響を抽出。

最初のUIでは、以下の3つを表示対象にする。

- 要点
- 技術者向け
- 批判的に読む

`impact` は、端末内の関心プロファイルや読書履歴を扱う設計ができてから追加する。

### UX

`ArticleDetail` に AI パネルを追加する。配置は記事ヘッダーまたは Reader Mode 操作部の下を想定する。

AI パネルに含めるもの:

- 要約視点を切り替えるセグメントコントロール
- 生成中のローディング状態
- 生成済み結果のキャッシュ表示
- 生成失敗時の再試行ボタン
- 端末内処理であることを示す表示

通常の記事閲覧を妨げないこと。記事詳細はすぐ開けるようにし、AI生成はユーザーが要求したときだけ実行する。

### 出力形式

描画前に、AI出力を構造化されたデータとして扱う。

```ts
type SummaryPerspective = 'brief' | 'technical' | 'critical' | 'impact';

type PerspectiveSummary = {
  articleId: string;
  perspective: SummaryPerspective;
  summary: string[];
  caveats?: string[];
  generatedAt: string;
  modelId: string;
};
```

`summary` は単一の長文ではなく配列で持つ。UIで安定した箇条書きとして表示しやすく、レイアウト崩れも抑えやすい。

## 機能2: 記事の信号分離

記事本文を、発言や情報の種類ごとに分解して表示する。ユーザーが「これは事実なのか」「筆者の主張なのか」「宣伝なのか」を読み分けやすくする。

### 初期の信号タイプ

- `fact`: 日付、リリース、仕様、数値、確認済みの出来事。
- `claim`: 筆者や企業の解釈・主張。
- `speculation`: 予測、不確かな結論、まだ確定していない見通し。
- `quote`: 引用文、または誰かに帰属している発言。
- `promotion`: 製品訴求、登録誘導、スポンサー的な表現。
- `unclear`: 根拠が曖昧な文、出典不足、意味が取りにくい箇所。

### UX

視点切り替え要約と同じ AI パネル内に、`Signals` 相当のモードを追加する。

初期版では、存在する信号タイプだけをグループ表示する。空のセクションは表示しない。

各項目に含めるもの:

- 抽出または要約した短い文
- 信号タイプ
- 信頼度: `high` / `medium` / `low`

過剰に断定しない。記事本文が短すぎる場合や分類が難しい場合は、「十分な本文がありません」「明確な信号を検出できませんでした」のような状態を表示する。

### 出力形式

```ts
type ArticleSignalType =
  | 'fact'
  | 'claim'
  | 'speculation'
  | 'quote'
  | 'promotion'
  | 'unclear';

type ArticleSignal = {
  type: ArticleSignalType;
  text: string;
  confidence: 'high' | 'medium' | 'low';
};

type ArticleSignalsResult = {
  articleId: string;
  signals: ArticleSignal[];
  generatedAt: string;
  modelId: string;
};
```

## 機能3: 記事チャット

開いている記事について、AIと対話しながら理解を深める機能。汎用チャットではなく、現在の記事を根拠にした読書支援チャットとして設計する。

初期版では、対象を現在開いている記事1件に限定する。保存済み記事全体や関連記事をまたいだチャットは、意味検索やローカルインデックスが必要になるため後続フェーズで扱う。

### 想定質問

- この記事の要点は？
- 筆者の主張は何？
- 事実と推測を分けて。
- 技術的な影響は？
- 何が新しい？
- 注意すべき点は？
- あとで確認することは？
- この記事だけでは判断できない点は？

### UX

`ArticleDetail` の AI パネルに `Chat` モードを追加する。

初期表示では、自由入力欄だけでなく、よく使う質問チップを表示する。

質問チップの候補:

- 要点は？
- 事実と主張を分けて
- 技術的な影響は？
- 何が新しい？
- 注意点は？
- あとで確認すること

チャットは通常の記事閲覧を妨げないよう、折りたたみ可能なパネルまたは下部シートとして扱う。長い会話ログが記事本文を押し出しすぎないようにする。

### 回答ルール

記事チャットでは、モデルに以下の制約を強く与える。

- 現在の記事本文に基づいて回答する。
- 記事に書かれていることと推測を分ける。
- 記事だけでは判断できない場合は、その旨を明示する。
- 外部知識で補う場合は、記事本文由来ではないことを明示する。
- 断定しすぎない。

回答には、可能であれば次の区分を持たせる。

```ts
type ArticleChatAnswer = {
  answer: string;
  basedOnArticle: string[];
  assumptions?: string[];
  notAnsweredByArticle?: string[];
  generatedAt: string;
  modelId: string;
};
```

`basedOnArticle` には、記事本文から根拠として使った要点を短く入れる。本文の長い引用は避け、要約された根拠として扱う。

### チャット履歴

初期版では、チャット履歴は端末内だけに保存する。Supabase には同期しない。

保存単位:

```ts
type ArticleChatMessage = {
  id: string;
  articleId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  modelId?: string;
};
```

履歴の保持期間は短くてよい。記事の7日TTLと合わせるか、ユーザーが記事詳細を閉じたら破棄する設定から始める。保存する場合も AsyncStorage で十分。

### リスク

チャットは自由入力のため、要約や信号分離よりもモデルの失敗が目立ちやすい。

主なリスク:

- 記事にないことをそれらしく答える。
- 小型モデルが長い記事全体を扱いきれない。
- 回答生成が遅く、読書体験を妨げる。
- 会話ログが増えてメモリを圧迫する。

対策:

- 初期版は単一記事チャットに限定する。
- Reader Mode本文が長すぎる場合は、先に短い記事コンテキストを作ってから回答する。
- 回答には「記事から言えること」「この記事だけでは不明」を含める。
- チャット履歴は短く保つ。
- 生成はユーザー操作時のみ実行する。

## 機能4: 記事読み上げ

`react-native-executorch` の Text to Speech 機能を使い、記事やAI生成結果を端末内で音声化する。

初期版では、全文読み上げではなく「要約の読み上げ」から始める。全文読み上げは記事が長く、分割、停止、再開、バックグラウンド再生、ロック画面操作などの考慮が増えるため、後続フェーズに分ける。

### 対象

初期対象:

- 視点切り替え要約の読み上げ
- 記事チャット回答の読み上げ

後続対象:

- Reader Mode本文の読み上げ
- 未読記事やお気に入り記事の音声ダイジェスト
- 複数記事の音声プレイリスト

### モデル方針

TTS は LLM とは別モデルとして扱う。

`react-native-executorch` の組み込みモデルから使いやすいものを選ぶ。初期候補:

- `KOKORO_SMALL`
- `KOKORO_MEDIUM`

音声もライブラリ提供の定数から選択する。自前TTSモデルは使わない。

注意点:

- Kokoro 系モデルはまず英語読み上げ向けとして評価する。
- 日本語記事を自然に読み上げられるかは実機で確認する。
- 日本語品質が不足する場合、初期リリースでは英語記事または英語要約の読み上げに限定する。

### UX

記事詳細の AI パネル内に、読み上げ操作を追加する。

初期UI:

- 再生
- 停止
- 読み上げ速度
- モデル未ダウンロード時の準備導線

例:

```txt
要点
- ...
- ...

[再生] [停止] 速度 1.0x
```

全文読み上げを追加する段階では、以下も必要になる。

- 一時停止 / 再開
- 前の段落 / 次の段落
- 読み上げ位置の表示
- 画面を閉じた後の再生方針
- バックグラウンド再生対応の可否

### AIモデル管理画面での扱い

LLM と TTS は別々に表示する。

```txt
オンデバイスAI

LLMモデル
状態: 使用可能
用途: 要約・信号分離・記事チャット

音声モデル
状態: 未ダウンロード
用途: 読み上げ
音声: Heart
[ダウンロード]
```

LLM が使用可能でも、TTS モデルは未ダウンロードの可能性がある。読み上げボタンは TTS モデルの状態を見て有効化する。

### 実装上の扱い

TTS は音声波形を生成し、再生には別途オーディオ再生処理が必要になる。

想定モジュール:

```txt
apps/mobile/src/ai/
  ttsService.js

apps/mobile/src/components/article/
  ArticleReadAloudControls.js
```

責務:

- `ttsService.js`: TTSモデルの初期化、読み上げ音声生成、速度指定。
- `ArticleReadAloudControls.js`: 再生、停止、速度変更、モデル状態表示。

全文読み上げでは、記事本文を段落単位に分割し、短いチャンクごとに音声生成する。長文を一括で `forward` しない。

### リスク

- 日本語読み上げ品質が不十分な可能性がある。
- 長文生成では初回音声までの待ち時間が長くなる。
- 音声生成とLLM生成を同時に動かすとメモリを圧迫する。
- バックグラウンド再生やロック画面操作は追加のネイティブ対応が必要になる。

対策:

- 初期版は短い要約読み上げに限定する。
- LLM生成中はTTS生成を同時実行しない。
- 長文は段落単位に分割する。
- 日本語品質が不足する場合は、対応範囲を明示する。

## アーキテクチャ

### 追加するパッケージ

`apps/mobile` に以下を追加する想定。

```bash
yarn workspace mobile add react-native-executorch
yarn workspace mobile add react-native-executorch-expo-resource-fetcher
yarn workspace mobile add expo-file-system expo-asset
```

実装前に、Expo / React Native の New Architecture が有効化できるか確認する。未対応の場合は、通常ビルドに混ぜず、実験用ブランチまたは専用の EAS build profile で検証する。

### 想定モジュール構成

```txt
apps/mobile/src/ai/
  initExecutorch.js
  models.js
  prompts.js
  summaryService.js
  signalService.js
  chatService.js
  ttsService.js
  aiCache.js
  useArticleAi.js

apps/mobile/src/components/article/
  ArticleAiPanel.js
  PerspectiveSummaryView.js
  ArticleSignalsView.js
  ArticleChatView.js
  ArticleReadAloudControls.js
```

責務:

- `initExecutorch.js`: ExecuTorch の初期化。
- `models.js`: 使用するモデル定義、モデルID、対応機能の管理。
- `prompts.js`: プロンプト生成とJSON出力指示。
- `summaryService.js`: 視点切り替え要約の生成。
- `signalService.js`: 信号分離結果の生成。
- `chatService.js`: 単一記事チャットの回答生成。
- `ttsService.js`: 要約や記事本文の読み上げ音声生成。
- `aiCache.js`: 生成結果のローカル保存・取得。
- `useArticleAi.js`: `ArticleDetail` から使うための hook。

### キャッシュ方針

初期版では端末内だけに保存し、Supabase には同期しない。

キャッシュキー:

```ts
type AiCacheKey = `${articleId}:${feature}:${mode}:${modelId}:${contentHash}`;
```

各要素:

- `feature`: `summary` または `signals`
- チャット履歴の場合は `chat`
- `mode`: 要約視点。信号分離の場合は `default`
- `contentHash`: 記事タイトル、RSS本文、Reader Mode本文が変わった場合に変わる値

初期実装では AsyncStorage で十分。意味検索や大きなローカルインデックスを扱う段階になったら SQLite への移行を検討する。

### 記事本文の取得優先度

AIに渡す本文は、利用できる中で最も情報量が多いものを使う。

優先順位:

1. Reader Mode で抽出した本文
2. RSS の description / content
3. タイトルとメタデータのみ

タイトルとメタデータしかない場合は、出力品質が限定されることをUIで示す。

## LLMモデルのダウンロードと管理

LLMモデルはアプリ本体に同梱せず、ユーザー操作で端末にダウンロードする。記事画面でAI機能を押しただけで、大容量モデルのダウンロードを暗黙に開始しない。

初期版では、自前変換モデルは使わない。`react-native-executorch` が定数として提供しているモデルだけを利用する。

理由:

- `.pte` 変換パイプラインを保守しなくてよい。
- tokenizer / tokenizer config の組み合わせミスを避けられる。
- モバイル実機で動く前提のモデルを選びやすい。
- ライブラリ更新に追従しやすい。
- 初期実装のリスクを下げられる。

### 初期候補モデル

初期検証では、以下のライブラリ提供モデルだけを候補にする。

```ts
import {
  LFM2_5_1_2B_INSTRUCT_QUANTIZED,
  QWEN2_5_1_5B_QUANTIZED,
  SMOLLM2_1_360M_QUANTIZED,
} from 'react-native-executorch';
```

使い分け:

- `LFM2_5_1_2B_INSTRUCT_QUANTIZED`: 最初の本命候補。要約、信号分離、記事チャットのバランス検証用。
- `QWEN2_5_1_5B_QUANTIZED`: 日本語記事や指示追従の比較候補。
- `SMOLLM2_1_360M_QUANTIZED`: 軽量フォールバック候補。低負荷検証用。

初期リリースでは、ユーザーにモデル選択UIを出さない。設定画面では `FeedOwn Local Reader` のような表示名だけを出し、内部実装では `models.js` で差し替え可能にする。

```ts
export const FEEDOWN_DEFAULT_LLM = LFM2_5_1_2B_INSTRUCT_QUANTIZED;

export const FEEDOWN_LLM_METADATA = {
  displayName: 'FeedOwn Local Reader',
  features: ['summary', 'signals', 'chat'],
};
```

### モデル状態

LLMモデルは以下の状態で管理する。

```ts
type AiModelStatus =
  | 'unsupported'
  | 'not_downloaded'
  | 'downloading'
  | 'paused'
  | 'ready'
  | 'update_available'
  | 'error';
```

状態の意味:

- `unsupported`: OS、端末、React Native構成が非対応。
- `not_downloaded`: モデル未ダウンロード。
- `downloading`: モデルをダウンロード中。
- `paused`: ダウンロード一時停止中。
- `ready`: モデル使用可能。
- `update_available`: 既存モデルは使えるが、新しいモデル定義がある。
- `error`: ダウンロード、読み込み、初期化に失敗。

### 設定画面

`設定 > オンデバイスAI` にモデル管理画面を追加する。

表示項目:

- AI読書支援の有効/無効
- モデル状態
- 表示名
- ダウンロードサイズ
- 端末上の使用容量
- 対応機能: 要約、信号分離、記事チャット
- 最終更新日
- ダウンロード / 一時停止 / 再開 / キャンセル / 削除
- Wi-Fi時のみダウンロード
- モバイル通信でのダウンロード許可
- ストレージ不足、OS非対応、初期化失敗の警告

画面例:

```txt
オンデバイスAI

[ ] AI読書支援を有効にする

LLMモデル
--------------------------------
FeedOwn Local Reader
要約・信号分離・記事チャット
サイズ: 約 1.2 GB
状態: 未ダウンロード

[ダウンロード]

ダウンロード設定
--------------------------------
[x] Wi-Fi接続時のみダウンロード
[ ] モバイル通信でのダウンロードを許可

ストレージ
--------------------------------
使用中: 0 MB
[モデルを削除]
```

ダウンロード中:

```txt
FeedOwn Local Reader
状態: ダウンロード中 42%

[==========              ]
残り 約 8分

[一時停止] [キャンセル]
```

### 記事画面からの導線

記事詳細でAI機能を開いたとき、LLMモデルが未ダウンロードなら、AIパネル内に準備導線を表示する。

```txt
AIモデルがまだありません

要約、信号分離、記事チャットを端末内で使うには
モデルのダウンロードが必要です。

サイズ: 約 1.2 GB
[モデルを準備]
```

`モデルを準備` は、設定画面に遷移するか、初回だけ下部シートでダウンロード確認を出す。どちらの場合も、ユーザー確認なしにダウンロードを開始しない。

### 実装ルール

- 初回ダウンロードはユーザー操作で開始する。
- ダウンロード前にサイズと通信量の目安を表示する。
- デフォルトではWi-Fi時のみダウンロードする。
- モデルは削除できるようにする。
- 非対応端末ではAI機能を無効化し、通常の記事閲覧は維持する。
- モデルがなくても、記事閲覧、既読、お気に入り、共有は通常通り動く。
- LLMモデルとTTSモデルは別々に管理する。

## モデル方針

最初は、現在の iOS / Android 実機で安定して動く小さめの ready-made LLM を使う。初期版では、モデル選択UIは出さない。

評価基準:

- 対応実機でクラッシュしない。
- 構造化JSONをある程度安定して出力できる。
- 1記事あたりの生成時間が許容範囲内。
- モデルダウンロードサイズが大きすぎない。
- 初回ダウンロード後はオフラインで動く。

フォールバック:

- モデル初期化に失敗したら、AI操作を無効化し、設定画面またはAIパネルに診断表示を出す。
- JSONパースに失敗したら、修復用プロンプトで1回だけ再試行する。
- 再試行も失敗した場合はキャッシュせず、手動再試行できるようにする。

## プライバシーとプロダクト上のルール

- 記事本文を外部AIサービスに送らない。
- 初期版では、生成された要約や信号分離結果をアップロードしない。
- モデル準備ができるまでは、機能を無効または明示的な実験機能として扱う。
- 初回モデルダウンロード前に、保存容量と通信量の目安を示す。
- AI出力は補助情報として扱い、事実として断定しない。

## 実装フェーズ

### Phase 0: 実現性検証

- Expo / React Native New Architecture の設定を確認する。
- 検証ブランチで `react-native-executorch` を導入する。
- 物理 iOS / Android 端末で最小モデルを実行する。
- モデルサイズ、初期化時間、メモリ使用、初回生成時間を測る。

完了条件:

- 端末上で1つのプロンプトを実行できる。
- 繰り返し生成してもアプリがクラッシュしない。
- App Store / Google Play 向けビルドに進める見通しがある。

### Phase 1: AIサービス層

- `src/ai` 配下のモジュールを追加する。
- ExecuTorch をアプリ起動時または初回AI操作時に初期化する。
- プロンプト生成を実装する。
- ローカルキャッシュを実装する。
- JSONパースと1回の修復リトライを実装する。

完了条件:

- UIなしで `PerspectiveSummary` を生成・キャッシュできる。
- 既存の記事閲覧機能に影響しない。

### Phase 2: 視点切り替え要約UI

- `ArticleDetail` に `ArticleAiPanel` を追加する。
- `要点` / `技術者向け` / `批判的に読む` の切り替えUIを追加する。
- 生成はユーザー操作時だけ行う。
- キャッシュ済み結果は即時表示する。
- ローディング、エラー、非対応端末状態を実装する。

完了条件:

- 記事詳細画面で視点別要約を生成できる。
- 同じ記事を開き直したときにキャッシュが使われる。

### Phase 3: 信号分離UI

- `ArticleAiPanel` に信号分離モードを追加する。
- 信号分離サービスを実装する。
- 信号タイプごとにグループ表示する。
- 空状態、低信頼度状態、本文不足状態を実装する。

完了条件:

- 対応記事で、事実・主張・推測・引用・宣伝・曖昧な情報を分類表示できる。

### Phase 4: 安定化

- 機能フラグまたは設定トグルを追加する。
- モデル状態を確認できるローカル診断表示を追加する。
- プロンプト、キャッシュキー、パーサ、UI状態のテストを追加する。
- 短いRSS本文と Reader Mode 本文の両方で検証する。
- 非対応端末と最小OS要件をドキュメント化する。

完了条件:

- 通常の記事閲覧を壊さず、実験機能として配布できる。

### Phase 5: 単一記事チャット

- `chatService.js` を追加する。
- `ArticleAiPanel` に `Chat` モードを追加する。
- よく使う質問チップを追加する。
- 現在の記事1件だけを根拠に回答するプロンプトを実装する。
- 回答に「記事から言えること」と「この記事だけでは不明」を含める。
- チャット履歴を端末内に短期保存する。

完了条件:

- 現在開いている記事について質問できる。
- 記事にない内容を聞かれたときに、判断できない旨を返せる。
- チャット機能が通常の記事閲覧、要約、信号分離を妨げない。

### Phase 6: 要約読み上げ

- `ttsService.js` を追加する。
- TTSモデルを LLM とは別に管理する。
- AIモデル管理画面に音声モデル状態を追加する。
- 視点切り替え要約の読み上げボタンを追加する。
- 記事チャット回答の読み上げボタンを追加する。
- 再生、停止、速度指定を実装する。

完了条件:

- 生成済み要約を端末内TTSで読み上げられる。
- TTSモデル未ダウンロード時に適切な準備導線を出せる。
- LLM生成とTTS生成の同時実行でアプリが不安定にならない。

### Phase 7: 本文読み上げ検討

要約読み上げが安定した後、Reader Mode本文の読み上げを検討する。

必要になる基盤:

- 段落単位の本文分割
- 一時停止 / 再開
- 前の段落 / 次の段落
- 読み上げ位置管理
- バックグラウンド再生方針

この段階でも、まずはアプリ表示中の再生に限定する。ロック画面操作やバックグラウンド再生は、必要性が確認できてから別フェーズに分ける。

### Phase 8: 関連記事チャット検討

単一記事チャットが安定した後、保存済み記事や関連記事を対象にしたチャットを検討する。

必要になる基盤:

- ローカル記事インデックス
- embedding 生成とキャッシュ
- SQLite などの永続ストレージ
- 検索対象記事の範囲指定UI

この段階では、現在の記事に近い数件の記事だけを根拠にする。全履歴を対象にした個人ライブラリチャットはさらに後の拡張とする。

## テスト計画

ユニットテスト:

- プロンプトに必要なJSONスキーマ指示が含まれる。
- 記事本文が変わるとキャッシュキーが変わる。
- パーサが正しいJSONを受け付け、不正なレスポンスを拒否する。
- 修復リトライが一般的な出力崩れに対応できる。
- 記事チャットが記事外の質問に対して「この記事だけでは不明」を返せる。
- TTSサービスが短いテキストから音声生成を開始できる。
- LLMモデルとTTSモデルの状態を別々に扱える。

手動テスト:

- iOS 17 以上の物理端末。
- Android 13 以上の物理端末。
- Reader Mode 本文がある長い記事。
- RSS description だけの短い記事。
- モデルダウンロード後のオフライン動作。
- アプリ再起動後のキャッシュ復元。
- ストレージ不足またはモデルダウンロード失敗。
- 記事チャットで短い質問を連続して送る。
- 記事にない内容を質問する。
- 要約読み上げを再生、停止する。
- 読み上げ速度を変更する。
- TTSモデル未ダウンロード状態で読み上げボタンを押す。

回帰確認:

- AI初期化に失敗しても記事閲覧は動く。
- お気に入り、既読、共有操作に影響しない。
- ダークモードとフォントサイズ設定が AI パネル周辺でも崩れない。
- TTS初期化に失敗しても要約、信号分離、記事チャットは動く。

## 未決事項

- 最初の検証に使う ready-made model はどれにするか。
- モデルダウンロードは初回AI操作時に行うか、設定画面で明示的に行うか。
- 初期版では、お気に入り記事または保存済み記事だけをAI対象にするか。
- 7日TTLで記事が消えるとき、AI生成結果も削除するか。
- 意味検索を近いうちに入れるなら、最初から SQLite を使うべきか。
- 記事チャット履歴は記事を閉じたら破棄するか、短期間保存するか。
- 初期TTS対象を要約だけにするか、記事チャット回答も含めるか。
- 日本語読み上げ品質が不足する場合、機能表示をどう制限するか。

## 最初の推奨マイルストーン

まずは開発者向けの隠し機能として、`ArticleDetail` に `brief` 要約だけを実装する。

Reader Mode 本文があればそれを使い、生成結果は端末内にキャッシュする。UIを磨く前に、物理 iOS / Android 端末でモデルの安定性、生成速度、メモリ使用量を確認する。

## 詳細設計メモ

ここから先は、実装時にそのままタスクへ分解できる粒度の補足設計とする。実装中に実機制約が見つかった場合は、この章を更新してからコード側に反映する。

## 画面設計

### 設定: オンデバイスAI

設定画面には、AI機能の入口を1つだけ置く。ユーザーに複数のモデル名や内部実装を意識させない。

画面名:

- `オンデバイスAI`

主なセクション:

- 機能状態
- LLMモデル
- 音声モデル
- ダウンロード設定
- ストレージ
- 診断

機能状態:

```txt
オンデバイスAI

[ ] AI読書支援を有効にする

記事本文、読書履歴、AI生成結果は端末内で処理されます。
モデルのダウンロード後はオフラインでも利用できます。
```

LLMモデル:

```txt
LLMモデル

FeedOwn Local Reader
用途: 要約・信号分離・記事チャット
状態: 未ダウンロード
サイズ: 約 1.2 GB
使用容量: 0 MB

[ダウンロード]
```

音声モデル:

```txt
音声モデル

FeedOwn Local Voice
用途: 要約・チャット回答の読み上げ
状態: 未ダウンロード
サイズ: 未確認
音声: Heart

[ダウンロード]
```

診断:

```txt
診断

New Architecture: 有効
OS: 対応
ストレージ: 十分
LLM: 未ダウンロード
TTS: 未ダウンロード
```

診断情報は開発中は常時表示してよい。本番では折りたたみ、または「詳細」ボタンの中に入れる。

### 記事詳細: AIパネル

`ArticleDetail` には、通常の記事本文の下、または Reader Mode 操作部の近くに `ArticleAiPanel` を置く。

初期状態:

```txt
AI
[要約] [信号] [チャット]

AIモデルがまだありません
要約、信号分離、記事チャットを端末内で使うにはモデルの準備が必要です。

[モデルを準備]
```

モデル準備済み:

```txt
AI
[要約] [信号] [チャット]

[要点] [技術者向け] [批判的]

[生成]
```

生成済み:

```txt
AI
[要約] [信号] [チャット]

要点
- ...
- ...
- ...

[再生成] [読み上げ]
```

チャット:

```txt
AI
[要約] [信号] [チャット]

[要点は？] [事実と主張を分けて] [注意点は？]

質問を入力
[送信]
```

TTS未準備:

```txt
読み上げには音声モデルが必要です。

[音声モデルを準備]
```

### AIパネルの表示ルール

- AIモデルが未ダウンロードでも、AIパネル自体は表示してよい。
- 非対応端末では、AIパネルに「この端末では利用できません」を表示する。
- AIパネルの表示で記事本文の初期描画を遅らせない。
- AI処理中でも、戻る、共有、お気に入り、既読操作はできる。
- 生成中に記事を閉じた場合は、可能なら処理を中断する。中断できない場合もUI更新は行わない。

## 状態管理

### モデル状態

LLM と TTS は別々に状態を持つ。

```ts
type LocalAiModelKind = 'llm' | 'tts';

type LocalAiModelState = {
  kind: LocalAiModelKind;
  status: AiModelStatus;
  displayName: string;
  modelId: string;
  version?: string;
  downloadProgress?: number;
  expectedBytes?: number;
  installedBytes?: number;
  lastError?: string;
  updatedAt?: string;
};
```

状態遷移:

```txt
unsupported

not_downloaded
  -> downloading

downloading
  -> ready
  -> paused
  -> error
  -> not_downloaded

paused
  -> downloading
  -> not_downloaded

ready
  -> update_available
  -> error
  -> not_downloaded

update_available
  -> downloading
  -> ready
  -> not_downloaded

error
  -> downloading
  -> not_downloaded
```

注意:

- `not_downloaded` は正常状態であり、エラーではない。
- `error` には必ずユーザー向けメッセージと開発者向け詳細を分けて保存する。
- `ready` でも初期化失敗が起きる可能性があるため、モデルロード時のエラーは別途扱う。

### AIジョブ状態

要約、信号分離、チャット、読み上げは同時に多数走らせない。

```ts
type AiJobType = 'summary' | 'signals' | 'chat' | 'tts';

type AiJobState = {
  type: AiJobType;
  articleId: string;
  status: 'idle' | 'queued' | 'running' | 'completed' | 'cancelled' | 'error';
  startedAt?: string;
  finishedAt?: string;
  error?: string;
};
```

初期版の同時実行ルール:

- LLMジョブは1つだけ実行する。
- TTSジョブは1つだけ実行する。
- LLM実行中はTTS生成を開始しない。
- TTS生成中はLLM生成を開始しない。
- 音声再生だけなら、LLM生成と同時に許可するかは実機検証後に決める。

## ローカル保存設計

### 保存先

初期版:

- 設定: AsyncStorage
- AI生成結果: AsyncStorage
- チャット履歴: AsyncStorage
- モデルファイル: `react-native-executorch` の resource fetcher 管理領域

将来:

- 意味検索、関連記事チャット、長期履歴が必要になったら SQLite を導入する。

### 保存キー

```ts
const AI_SETTINGS_KEY = 'feedown:ai:settings';
const AI_MODEL_STATE_KEY = 'feedown:ai:model-state';
const AI_SUMMARY_CACHE_PREFIX = 'feedown:ai:summary:';
const AI_SIGNALS_CACHE_PREFIX = 'feedown:ai:signals:';
const AI_CHAT_PREFIX = 'feedown:ai:chat:';
const AI_TTS_SETTINGS_KEY = 'feedown:ai:tts-settings';
```

要約キャッシュ:

```ts
type SummaryCacheRecord = {
  cacheVersion: 1;
  articleId: string;
  contentHash: string;
  perspective: SummaryPerspective;
  result: PerspectiveSummary;
  createdAt: string;
  expiresAt?: string;
};
```

信号分離キャッシュ:

```ts
type SignalsCacheRecord = {
  cacheVersion: 1;
  articleId: string;
  contentHash: string;
  result: ArticleSignalsResult;
  createdAt: string;
  expiresAt?: string;
};
```

チャット履歴:

```ts
type ArticleChatThread = {
  cacheVersion: 1;
  articleId: string;
  contentHash: string;
  messages: ArticleChatMessage[];
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
};
```

削除ルール:

- 記事がTTLで消える場合、AIキャッシュも削除対象にする。
- ユーザーが「全データ削除」を実行した場合、AI設定以外の生成結果を削除する。
- ユーザーが「AIデータ削除」を実行した場合、要約、信号分離、チャット履歴、TTS一時データを削除する。
- モデル削除は生成結果削除とは別操作にする。

## プロンプト設計

### 共通ルール

すべてのLLMプロンプトに含めるルール:

- 入力記事に基づいて回答する。
- 記事にないことは推測として分ける。
- 不明な場合は不明と答える。
- JSONだけを返す。
- Markdown装飾を返さない。
- 長い引用を避ける。
- 日本語記事には日本語で返す。
- 英語記事には原則としてユーザーのUI言語に合わせる。初期版では日本語UIなら日本語で返す。

### 要約プロンプト

入力:

- 記事タイトル
- フィード名
- 公開日
- URL
- 本文
- 要約視点

出力:

```json
{
  "summary": ["...", "..."],
  "caveats": ["..."]
}
```

要約視点ごとの追加指示:

- `brief`: 3から5項目で、事実中心に短くまとめる。
- `technical`: 仕様、実装、依存関係、移行影響、リスクを優先する。
- `critical`: 根拠不足、誇張、未確認情報、利害関係を優先する。
- `impact`: ユーザーの関心情報がある場合だけ使う。初期版ではUI非表示。

### 信号分離プロンプト

出力:

```json
{
  "signals": [
    {
      "type": "fact",
      "text": "...",
      "confidence": "high"
    }
  ]
}
```

制約:

- 各タイプ最大5件まで。
- 記事本文が短い場合は件数を減らす。
- 断定できないものは `unclear` に入れる。
- 宣伝的表現は `promotion` に入れるが、通常の製品説明を過剰に宣伝扱いしない。

### チャットプロンプト

入力:

- 記事コンテキスト
- 直近の会話履歴
- ユーザー質問

出力:

```json
{
  "answer": "...",
  "basedOnArticle": ["..."],
  "assumptions": ["..."],
  "notAnsweredByArticle": ["..."]
}
```

制約:

- 記事外の一般知識で補った場合は `assumptions` に入れる。
- 記事から答えられない場合は `notAnsweredByArticle` に理由を入れる。
- `answer` は短く、必要なら箇条書き風の文にする。
- 会話履歴は長くなりすぎないよう、直近数件だけ渡す。

## 記事コンテキスト生成

LLMに本文全体をそのまま渡せない場合に備え、記事コンテキストを作る。

```ts
type ArticleAiContext = {
  articleId: string;
  title: string;
  feedTitle?: string;
  url?: string;
  publishedAt?: string;
  contentSource: 'reader' | 'rss' | 'metadata';
  contentHash: string;
  text: string;
  truncated: boolean;
  language?: string;
};
```

生成ルール:

- Reader Mode本文がある場合は優先する。
- HTMLタグは除去する。
- 連続空白を正規化する。
- URL一覧、広告文、ナビゲーション文は可能な範囲で除去する。
- 長すぎる場合は先頭、中盤、末尾を残す。
- 切り詰めた場合は `truncated: true` にする。

チャット用コンテキスト:

- 長文の場合は、先に短い要約コンテキストを作る。
- チャットでは毎回全文を渡さず、要約コンテキストと質問を渡す。
- 要約コンテキスト自体も `contentHash` と紐付けてキャッシュする。

## モデル管理の詳細

### ダウンロード開始条件

LLM:

- 端末が対応OSである。
- New Architecture が有効である。
- ストレージ空き容量が推定サイズを上回る。
- ユーザーが明示的に開始した。
- Wi-Fi制限が有効な場合はWi-Fi接続中である。

TTS:

- LLMとは独立に開始できる。
- ただし初期版では、AI読書支援が有効な場合だけ表示する。

### ダウンロード失敗時

表示例:

```txt
モデルをダウンロードできませんでした

通信状態または空き容量を確認してください。

[再試行] [詳細]
```

詳細に含めるもの:

- モデル種別
- モデルID
- 進捗
- エラーコード
- 発生時刻

### モデル更新

初期版では自動更新しない。

`update_available` になった場合:

- 既存モデルが使えるならそのまま使う。
- 更新はユーザー操作で開始する。
- 更新前にサイズを表示する。
- 更新失敗時は既存モデルを使い続ける。

## エラー表示方針

ユーザー向けメッセージは短く、復旧操作を明示する。

代表例:

| 状態 | 表示 | 操作 |
| --- | --- | --- |
| 非対応端末 | この端末ではオンデバイスAIを利用できません | 詳細 |
| 未ダウンロード | AIモデルの準備が必要です | モデルを準備 |
| ダウンロード失敗 | モデルをダウンロードできませんでした | 再試行 |
| 初期化失敗 | AIモデルを起動できませんでした | 再試行 / モデル削除 |
| 本文不足 | 十分な記事本文がありません | 原文を開く |
| JSON崩れ | AI出力を読み取れませんでした | 再生成 |
| メモリ不足 | この端末では処理を完了できませんでした | 閉じる |

## アクセシビリティ

- AIパネルのタブはスクリーンリーダーで読み上げ可能にする。
- 生成中状態は `accessibilityLiveRegion` 相当の扱いを検討する。
- 読み上げボタンはTTS機能と混同しないラベルにする。
- 再生中は「停止」ボタンへフォーカスしやすくする。
- 速度変更は数値だけでなく `標準`、`速い`、`遅い` の表示を併用する。
- 色だけで状態を示さない。

## パフォーマンス目標

初期検証で測る指標:

- LLMモデルのダウンロードサイズ
- LLM初期化時間
- 要約生成時間
- チャット初回回答時間
- 信号分離生成時間
- TTS初回音声までの時間
- ピークメモリ
- アプリクラッシュ有無
- バッテリー消費の体感

目標値の初期案:

| 指標 | 目標 |
| --- | --- |
| 要約生成 | 30秒以内 |
| 信号分離 | 45秒以内 |
| チャット回答 | 30秒以内 |
| TTS短文開始 | 10秒以内 |
| アプリ操作不能時間 | 0秒 |
| 通常記事表示への影響 | なし |

この目標を満たせない場合、初期リリースでは機能を隠すか、開発者向け設定に限定する。

## 実装タスク分解

### タスクA: 事前調査

- `apps/mobile` の New Architecture 設定を確認する。
- Expo SDK / React Native / EAS Build の対応状況を確認する。
- iOS 17+ と Android 13+ の実機を用意する。
- 既存 `ArticleDetail.js` の本文データ構造を確認する。
- Reader Mode 本文の取得タイミングを確認する。

成果物:

- 実機検証メモ
- 使用モデル候補の比較表
- 実装可否判断

### タスクB: モデル管理基盤

- `src/ai/models.js` を作る。
- `src/ai/modelState.js` または同等の管理処理を作る。
- LLM/TTSの状態をAsyncStorageへ保存する。
- 設定画面にオンデバイスAIセクションを追加する。
- ダウンロード進捗UIを作る。

成果物:

- モデル未ダウンロード、ダウンロード中、使用可能、エラーがUIで確認できる。

### タスクC: 記事コンテキスト

- `src/ai/articleContext.js` を作る。
- Reader Mode本文、RSS本文、メタデータからAI入力を作る。
- `contentHash` を作る。
- 長文切り詰めを実装する。
- 本文不足状態を判定する。

成果物:

- 任意の記事から `ArticleAiContext` を生成できる。

### タスクD: LLMサービス

- `initExecutorch.js` を作る。
- `summaryService.js` を作る。
- `signalService.js` を作る。
- `chatService.js` を作る。
- JSONパースと修復リトライを実装する。
- LLMジョブの排他制御を実装する。

成果物:

- UIなしで要約、信号分離、チャット回答を生成できる。

### タスクE: AIパネルUI

- `ArticleAiPanel.js` を作る。
- `PerspectiveSummaryView.js` を作る。
- `ArticleSignalsView.js` を作る。
- `ArticleChatView.js` を作る。
- `ArticleDetail.js` に組み込む。
- ダークモード、フォントサイズ設定に対応する。

成果物:

- 記事詳細でAI機能を操作できる。

### タスクF: TTS

- `ttsService.js` を作る。
- `ArticleReadAloudControls.js` を作る。
- 要約読み上げを実装する。
- チャット回答読み上げを実装する。
- TTSジョブの排他制御を実装する。

成果物:

- 生成済み要約とチャット回答を読み上げられる。

### タスクG: テストと安定化

- プロンプト生成のユニットテストを追加する。
- キャッシュキーのユニットテストを追加する。
- JSONパーサのユニットテストを追加する。
- 手動テスト手順を整備する。
- 実機ベンチ結果を記録する。

成果物:

- 実験機能として配布できる判断材料が揃う。

## リリース判断

### 実験機能として出してよい条件

- 通常の記事閲覧が壊れない。
- モデル未ダウンロード状態でアプリが自然に使える。
- モデル削除後も正常に戻る。
- 要約が最低限読める品質で生成される。
- 記事チャットが記事外質問に対して不明と答えられる。
- 少なくとも1台のiOS実機と1台のAndroid実機でクラッシュしない。

### 出さない条件

- モデル初期化でアプリ全体が落ちる。
- 記事詳細の表示が明確に遅くなる。
- ストレージ不足時の復旧導線がない。
- 日本語記事に対して意味不明な出力が多い。
- AI出力が記事外の内容を頻繁に断定する。

## 将来拡張

### 意味検索

記事本文から embedding を生成し、保存済み記事を自然文で検索する。これは LLMチャットよりもRSSリーダーとしての価値が高い可能性がある。

必要なもの:

- text embedding モデル
- SQLite
- 記事IDとembeddingの永続化
- contentHash による再生成制御
- 検索UI

### 関連記事チャット

現在の記事に近い記事を数件取り出し、その範囲だけでチャットする。

制約:

- 対象記事を明示する。
- 回答に根拠記事を表示する。
- 全履歴を無制限に対象にしない。

### 音声ダイジェスト

未読記事から要約を作り、それを連続再生する。

初期案:

- 今日の未読から最大5件
- お気に入りフィード優先
- 1記事30秒以内
- バックグラウンド再生は後回し

## ドキュメント更新ルール

実装中に以下が決まったら、この計画書を更新する。

- 採用モデル
- 実測モデルサイズ
- 実測メモリ使用量
- 実測生成速度
- 日本語読み上げ品質
- 非対応端末の表示
- 設定画面の最終UI
- リリース対象範囲

## 追加ライブラリ一覧

モバイルアプリは Yarn workspaces 配下にあるため、通常の npm パッケージはリポジトリルートから `yarn workspace mobile add ...` で追加する。

Expo SDK とバージョン整合が必要な Expo 公式パッケージは、可能なら次の形式を使う。

```bash
yarn workspace mobile expo install <package>
```

うまく動かない場合は、次の形式で追加し、依存が `apps/mobile/package.json` に入っていることを確認する。

```bash
cd apps/mobile
npx expo install <package>
```

### 必須候補

| 用途 | パッケージ | 追加方法 | 備考 |
| --- | --- | --- | --- |
| ExecuTorch本体 | `react-native-executorch` | `yarn workspace mobile add react-native-executorch` | LLM/TTS実行の本体 |
| Expo用モデル取得 | `react-native-executorch-expo-resource-fetcher` | `yarn workspace mobile add react-native-executorch-expo-resource-fetcher` | Expo環境でモデルを取得する |
| チャットUI | `react-native-gifted-chat` | `yarn workspace mobile add react-native-gifted-chat` | 記事チャットUIに採用する |

### Expo install 推奨

| 用途 | パッケージ | 追加方法 | 備考 |
| --- | --- | --- | --- |
| ファイル操作 | `expo-file-system` | `yarn workspace mobile expo install expo-file-system` | モデル/一時ファイル/容量確認で使う可能性が高い |
| アセット管理 | `expo-asset` | `yarn workspace mobile expo install expo-asset` | モデル/音声関連アセットで必要になる可能性 |
| ネットワーク状態 | `expo-network` | `yarn workspace mobile expo install expo-network` | Wi-Fi時のみダウンロード判定に使う |
| 端末情報 | `expo-device` | `yarn workspace mobile expo install expo-device` | OS/端末対応判定に使う |
| クリップボード | `expo-clipboard` | `yarn workspace mobile expo install expo-clipboard` | AI回答や要約のコピーに使う |
| 開発ビルド | `expo-dev-client` | `yarn workspace mobile expo install expo-dev-client` | New Architecture / ネイティブ依存の検証に使う |
| 触覚フィードバック | `expo-haptics` | `yarn workspace mobile expo install expo-haptics` | 生成完了、送信、エラー時の軽いフィードバック |
| Deep Link | `expo-linking` | `yarn workspace mobile expo install expo-linking` | 記事URL、設定導線、将来の共有導線で使う |
| メディア保存 | `expo-media-library` | `yarn workspace mobile expo install expo-media-library` | 将来の音声ダイジェスト保存やエクスポート候補 |
| 通知 | `expo-notifications` | `yarn workspace mobile expo install expo-notifications` | モデルDL完了、ダイジェスト生成完了などの通知候補 |
| ローカルDB | `expo-sqlite` | `yarn workspace mobile expo install expo-sqlite` | 意味検索、関連記事チャット、長期AI履歴に備えて導入 |
| 音声再生 | `expo-audio` | `yarn workspace mobile expo install expo-audio` | TTS音声再生の第一候補 |
| 動画/将来のメディア | `expo-video` | `yarn workspace mobile expo install expo-video` | 直接のAI機能では必須ではないが、Expoの新APIへ寄せる |

### TTS再生で検証する候補

`react-native-executorch` のTTS例では、生成した波形の再生に `react-native-audio-api` を使っている。Expo環境での相性を確認し、まずは `expo-audio` で足りるか、`react-native-audio-api` が必要かを実機で判断する。

| 用途 | パッケージ | 追加方法 | 備考 |
| --- | --- | --- | --- |
| 低レベル音声再生 | `react-native-audio-api` | `yarn workspace mobile add react-native-audio-api` | TTSの `Float32Array` 再生で必要になる可能性 |

初期方針:

- `expo-av` は非推奨扱いのため新規導入しない。
- まず `expo-audio` で再生できるか確認する。
- TTSの返す `Float32Array` を直接扱う必要が強い場合は `react-native-audio-api` を検討する。
- バックグラウンド再生やロック画面操作は初期スコープ外にする。

### まだ入れない候補

| 用途 | パッケージ | 理由 |
| --- | --- | --- |
| embedding検索 | 未定 | 意味検索フェーズでモデルと保存方式を決める |
| バックグラウンド音声 | `expo-audio` 周辺 | 本文読み上げや音声ダイジェストまで後回し |
| markdown表示 | 未定 | AI出力は構造化JSONとして描画し、Markdown依存を避ける |

### 追加コマンド案

初期スパイク:

```bash
yarn workspace mobile add react-native-executorch react-native-executorch-expo-resource-fetcher
yarn workspace mobile add react-native-gifted-chat
yarn workspace mobile expo install expo-file-system expo-asset expo-network expo-device
yarn workspace mobile expo install expo-clipboard expo-dev-client expo-haptics expo-linking
yarn workspace mobile expo install expo-media-library expo-notifications expo-sqlite
```

TTS検証時:

```bash
yarn workspace mobile expo install expo-audio expo-video
```

`react-native-audio-api` が必要と判断した場合:

```bash
yarn workspace mobile add react-native-audio-api
```

### react-native-gifted-chat の利用方針

記事チャットUIは `react-native-gifted-chat` を採用する。

理由:

- 吹き出し、入力欄、送信、スクロール、キーボード追従を自前実装しなくてよい。
- 単一記事チャットの初期実装を早く作れる。
- 既存の `ArticleChatMessage` と変換しやすい。

内部データとの変換:

```ts
type GiftedChatMessage = {
  _id: string;
  text: string;
  createdAt: Date;
  user: {
    _id: 'user' | 'assistant';
    name: string;
  };
};
```

変換ルール:

- `ArticleChatMessage.role === 'user'` は GiftedChat の user `_id: 'user'`
- `ArticleChatMessage.role === 'assistant'` は `_id: 'assistant'`
- `createdAt` は ISO文字列と `Date` を相互変換する
- 記事根拠や `notAnsweredByArticle` は通常メッセージ本文に混ぜすぎず、必要ならメッセージ下部の補足UIとして出す

質問チップは `GiftedChat` の上部、または入力欄の直上に別コンポーネントとして置く。質問チップを押したら、その文面をユーザーメッセージとして送信する。

注意点:

- ダークモードに合わせて bubble/input toolbar をカスタムする。
- フォントサイズ設定を反映する。
- 長い回答で記事本文全体を押し出しすぎないよう、AIパネルの高さ制限を検討する。
- `react-native-gifted-chat` の依存が現在の React Native / Expo SDK と衝突しないか、導入時に確認する。

## 実装引き継ぎチェックリスト

この章は、別セッションや別担当者がこのドキュメントだけを見て実装に入るための作業手順である。最初の実装では、すべてを一度に完成させない。まずは「モデル管理 + 単一記事の要約生成」までを通す。

### 実装前提

- 対象は `apps/mobile`。
- 初期実装はモバイル限定。
- Web版には手を入れない。
- 自前変換モデルは使わない。
- `react-native-executorch` が提供するモデル定数のみを使う。
- 最初のユーザー向けモデル名は `FeedOwn Local Reader` とする。
- まずは要約だけを動かし、その後に信号分離、記事チャット、TTSを追加する。
- `expo-sqlite` は依存として追加してよいが、初期要約実装では使わない。
- AI生成結果は初期版では Supabase に同期しない。

### Step 1: 依存追加

作業ディレクトリ:

```bash
C:\Users\all\develop\expo\feedown
```

追加コマンド:

```bash
yarn workspace mobile add react-native-executorch react-native-executorch-expo-resource-fetcher
yarn workspace mobile add react-native-gifted-chat
yarn workspace mobile expo install expo-file-system expo-asset expo-network expo-device
yarn workspace mobile expo install expo-clipboard expo-dev-client expo-haptics expo-linking
yarn workspace mobile expo install expo-media-library expo-notifications expo-sqlite
yarn workspace mobile expo install expo-audio expo-video
```

必要になった場合のみ:

```bash
yarn workspace mobile add react-native-audio-api
```

確認すること:

- 依存が `apps/mobile/package.json` に追加されている。
- ルートの lockfile が更新されている。
- `expo-av` は追加しない。
- `npm install` と `yarn add` を混在させない。

完了条件:

- `apps/mobile/package.json` に必要な依存が入っている。
- インストール後に依存解決エラーが残っていない。

### Step 2: Expo / New Architecture / dev client 確認

確認対象:

- `apps/mobile/app.json` または `app.config.*`
- `apps/mobile/eas.json`
- `apps/mobile/package.json`
- Expo SDK バージョン
- React Native New Architecture の有効化状態

確認すること:

- `react-native-executorch` は New Architecture 前提。
- Expo Go では動かない可能性が高い。
- `expo-dev-client` を使った開発ビルドで検証する。
- iOS 17+ / Android 13+ の物理端末で確認する。

完了条件:

- 開発ビルドでネイティブ依存を読み込める見通しがある。
- New Architecture が無効なら、実装前に有効化方針を決める。

### Step 3: AI基盤ディレクトリを追加

追加するディレクトリ:

```txt
apps/mobile/src/ai/
```

最初に追加するファイル:

```txt
apps/mobile/src/ai/models.js
apps/mobile/src/ai/aiStorage.js
apps/mobile/src/ai/articleContext.js
apps/mobile/src/ai/prompts.js
apps/mobile/src/ai/jsonOutput.js
apps/mobile/src/ai/summaryService.js
apps/mobile/src/ai/useArticleAi.js
```

後続で追加するファイル:

```txt
apps/mobile/src/ai/signalService.js
apps/mobile/src/ai/chatService.js
apps/mobile/src/ai/ttsService.js
apps/mobile/src/ai/modelState.js
```

初期実装の役割:

- `models.js`: `FEEDOWN_DEFAULT_LLM` と表示メタデータを定義する。
- `aiStorage.js`: AsyncStorage ベースのAI設定/キャッシュ保存。
- `articleContext.js`: 記事データからLLM入力用テキストを作る。
- `prompts.js`: 要約プロンプトを作る。
- `jsonOutput.js`: JSONパースと簡易バリデーション。
- `summaryService.js`: LLMで要約を生成する。
- `useArticleAi.js`: UIから使う状態管理hook。

完了条件:

- UIなしで記事データから `ArticleAiContext` を作れる。
- 要約用プロンプトを生成できる。
- キャッシュキーを生成できる。

### Step 4: モデル管理UIを設定画面に追加

既存の候補ファイル:

```txt
apps/mobile/src/scenes/profile/Profile.js
apps/mobile/src/contexts/ThemeContext.js
apps/mobile/src/utils/storage.js
apps/mobile/src/components/ScreenTemplate.js
```

実装方針:

- 既存アプリでは設定系UIが `Profile.js` にある可能性が高い。
- まず `Profile.js` に「オンデバイスAI」セクションを追加する。
- 大きくなりすぎる場合は `apps/mobile/src/scenes/profile/OnDeviceAiSettings.js` を新規作成する。
- ダークモードとフォントサイズ設定は既存の `ThemeContext` に合わせる。

表示する状態:

- AI読書支援の有効/無効
- LLMモデル状態
- TTSモデル状態
- Wi-Fi時のみダウンロード
- モバイル通信許可
- モデル削除
- 診断情報

初期版で実装してよい最小UI:

- LLMモデル状態表示
- ダウンロード/削除ボタン
- Wi-Fi時のみダウンロード設定
- 非対応端末表示

完了条件:

- 設定画面でAIモデル状態を確認できる。
- 未ダウンロード状態で「ダウンロード」導線が見える。
- モデルがなくても通常設定画面が壊れない。

### Step 5: ArticleDetail に AIパネルを追加

既存の対象ファイル:

```txt
apps/mobile/src/scenes/article/ArticleDetail.js
apps/mobile/src/components/ArticleReader.js
```

追加する候補ファイル:

```txt
apps/mobile/src/components/ArticleAiPanel.js
apps/mobile/src/components/PerspectiveSummaryView.js
```

実装方針:

- `ArticleDetail.js` に直接大きなAIロジックを書かない。
- `ArticleDetail.js` は記事データを `ArticleAiPanel` に渡すだけにする。
- `ArticleAiPanel` 内で `useArticleAi(article)` を使う。
- Reader Mode本文が取得できる場合は `articleContext.js` に渡す。

最小UI:

```txt
AI
[要点] [技術者向け] [批判的]
[生成]
```

モデル未準備UI:

```txt
AIモデルがまだありません
[モデルを準備]
```

完了条件:

- 記事詳細を開いても既存本文表示が壊れない。
- AIパネルが表示される。
- モデル未準備時の導線が表示される。

### Step 6: 要約生成を最初に通す

最初に実装する機能:

- `brief` 要約のみ

次に追加する機能:

- `technical`
- `critical`

実装順:

1. `ArticleAiContext` を作る。
2. `brief` プロンプトを作る。
3. LLMへ送る。
4. JSONをパースする。
5. `PerspectiveSummary` に変換する。
6. AsyncStorageへキャッシュする。
7. UIに表示する。

完了条件:

- 物理端末で1記事の要約を生成できる。
- 同じ記事を開き直すとキャッシュが表示される。
- 生成失敗時に再試行できる。
- モデル未ダウンロード時にクラッシュしない。

### Step 7: 信号分離を追加

追加するファイル:

```txt
apps/mobile/src/ai/signalService.js
apps/mobile/src/components/ArticleSignalsView.js
```

実装内容:

- `fact`
- `claim`
- `speculation`
- `quote`
- `promotion`
- `unclear`

完了条件:

- 記事本文から信号タイプ別の表示ができる。
- 本文不足時に空状態を出せる。
- 低信頼度の結果を過剰に断定して表示しない。

### Step 8: react-native-gifted-chat で単一記事チャットを追加

追加するファイル:

```txt
apps/mobile/src/ai/chatService.js
apps/mobile/src/components/ArticleChatView.js
```

実装方針:

- `react-native-gifted-chat` を使う。
- 対象は現在の記事1件だけ。
- よく使う質問チップを入力欄の上に置く。
- チャット履歴は端末内のみ。
- 履歴は短期保存、または記事を閉じたら破棄から始める。

質問チップ:

- 要点は？
- 事実と主張を分けて
- 技術的な影響は？
- 何が新しい？
- 注意点は？
- あとで確認すること

完了条件:

- 記事について質問できる。
- 記事にない質問では「この記事だけでは不明」を返せる。
- 長い回答でもUIが崩れない。
- ダークモードとフォントサイズ設定に対応している。

### Step 9: 要約/チャット回答の読み上げを追加

追加するファイル:

```txt
apps/mobile/src/ai/ttsService.js
apps/mobile/src/components/ArticleReadAloudControls.js
```

実装方針:

- 初期対象は要約とチャット回答。
- Reader Mode本文の全文読み上げは後回し。
- `expo-audio` で再生できるか先に検証する。
- だめなら `react-native-audio-api` を検討する。
- `expo-av` は使わない。

完了条件:

- 生成済み要約を読み上げられる。
- 停止できる。
- 速度指定ができる。
- TTSモデル未準備時に導線が出る。

### Step 10: SQLite を使うタイミング

`expo-sqlite` は依存として追加するが、初期要約/単一記事チャットでは使わない。

使い始めるタイミング:

- 意味検索
- 関連記事チャット
- 長期チャット履歴
- embedding キャッシュ
- 多数の記事AI結果の永続化

初期実装の保存先:

- AI設定: AsyncStorage
- 要約キャッシュ: AsyncStorage
- 信号分離キャッシュ: AsyncStorage
- 単一記事チャット履歴: AsyncStorage

完了条件:

- 初期実装ではSQLiteのスキーマ設計に踏み込まない。
- SQLiteは後続フェーズ用の依存として扱う。

### Step 11: 実機検証

必須:

- iOS 17+ 物理端末
- Android 13+ 物理端末
- dev client build

確認項目:

- アプリ起動
- 記事一覧
- 記事詳細
- Reader Mode
- モデル未ダウンロード状態
- モデルダウンロード
- 要約生成
- キャッシュ復元
- オフライン要約表示
- モデル削除
- 低ストレージ/通信失敗時の表示

測定すること:

- モデルサイズ
- ダウンロード時間
- 初期化時間
- 要約生成時間
- ピークメモリの体感
- クラッシュ有無

完了条件:

- 通常の記事閲覧が壊れていない。
- モデルがない状態でもアプリが自然に使える。
- 要約生成が実機で1回以上成功している。

### Step 12: mainでの初回実装スコープ

mainで最初に実装する:

- 依存追加
- AIモデル管理の最小UI
- `src/ai` 基盤
- `ArticleAiPanel`
- `brief` 要約生成
- 要約キャッシュ
- 実機検証メモ

最初の実装では後回しにする:

- 信号分離
- 記事チャット
- TTS
- 関連記事チャット
- 意味検索
- SQLiteスキーマ
- バックグラウンド再生

初回実装の完了条件:

- モデル未ダウンロード時のUIがある。
- モデル準備済みなら1記事の要約が生成できる。
- 失敗時に通常の記事閲覧が壊れない。
- ドキュメントに実測値を追記している。

### Step 13: mainでの後続実装順

作業2:

- `technical` / `critical` 要約
- 要約UIの改善
- コピー、haptics、エラー表示改善

作業3:

- 信号分離
- `ArticleSignalsView`
- 低信頼度/本文不足UI

作業4:

- `react-native-gifted-chat` による単一記事チャット
- 質問チップ
- チャット履歴

作業5:

- TTSモデル管理
- 要約読み上げ
- チャット回答読み上げ

作業6:

- SQLiteを使った意味検索の検証
- 関連記事チャットの技術検証

mainで直接作業するため、各作業の区切りでは最低限以下を確認する。

- 既存の記事閲覧が壊れていない。
- モデル未準備状態でクラッシュしない。
- 追加した設定項目が保存/復元できる。
- 実機検証で見つかった制約をこの計画書に追記している。
