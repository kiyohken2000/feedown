# モバイル版オンデバイスAI実装計画

## 目的

`react-native-executorch` を使い、FeedOwn のモバイルアプリにプライバシー重視のAI読書支援機能を追加する。

最初に対象にする機能は次の5つ。

1. 視点切り替え要約
2. 記事の信号分離
3. 記事チャット
4. 記事読み上げ
5. 記事翻訳

FeedOwn を汎用チャットAIアプリにすることが目的ではない。目的は、記事本文・読書履歴・関心情報を端末外に送らずに、読む負担を減らすこと。

機能の実装順序は後述の `実装フェーズ` を参照。番号は機能の説明順であり、実装順ではない。翻訳は信号分離が動いた直後 (Phase 5) に着手する想定。

## 現在の進捗

2026-05-07 時点で、ネイティブ依存と dev client ビルドの準備は完了している。
ここから先は、主に `apps/mobile/src` 配下の JavaScript 実装を進める段階。

完了済み:

- `apps/mobile/package.json` に `react-native-executorch` と `react-native-executorch-expo-resource-fetcher` が追加済み。
- `react-native-gifted-chat` が追加済み。
- `react-native-enriched-markdown` が追加済み。
- `expo-dev-client` が追加済み。
- `expo-audio` と `expo-video` が追加済み。`expo-av` は使わない。
- `expo-clipboard`、`expo-haptics`、`expo-linking`、`expo-notifications`、`expo-sqlite` など、AI機能周辺で使う候補依存が追加済み。
- `apps/mobile/app.json` で `newArchEnabled: true` が設定済み。
- `apps/mobile/app.json` の plugin に `expo-asset`、`expo-camera`、`expo-sqlite`、`expo-audio`、`expo-video` が入っている。
- dev client のビルドは完了済み。

未実装:

- `apps/mobile/src/ai/` はまだ存在しない。
- AIモデル管理、モデル選択、ダウンロード状態管理は未実装。
- `ArticleDetail.js` へのAIパネル接続は未実装。
- `Profile.js` へのオンデバイスAI設定UIは未実装。
- 要約、信号分離、記事チャット、翻訳、読み上げのJSサービス層は未実装。

次の実装開始点:

1. `apps/mobile/src/ai/models.js` で LLM 候補一覧と既定モデルを定義する。
2. `apps/mobile/src/ai/aiStorage.js` と `modelState.js` で設定・モデル状態を保存する。
3. `Profile.js` にオンデバイスAI設定セクションを追加し、選択中LLMモデルとダウンロード状態を表示する。
4. `articleContext.js`、`prompts.js`、`summaryService.js` を作り、まず1記事の要約生成だけを通す。
5. `ArticleDetail.js` に `ArticleAiPanel` を追加する。
6. (Phase 4.5) 要約翻訳を `translationService.js` で追加する。

翻訳機能は要約・信号分離が動いた直後 (Phase 4.5) に着手する想定。ただし Phase 0 の品質評価で小型量子化 LLM の翻訳が実用に耐えないと分かった場合は Phase 4.5 を保留する。

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

## 機能5: 記事翻訳

英語など、ユーザーが普段使わない言語の記事を、端末内で翻訳する機能。Google翻訳やDeepLに記事本文を送らずに翻訳できる点が、FeedOwn のプライバシー方針と整合する。RSS購読の中心的なユースケースであり、要約・信号分離・チャットよりも日常的な利用頻度が高い可能性がある。

初期版では、要約の翻訳から始める。記事本文の全文翻訳は出力トークン数が多く、小型量子化LLMでは実用速度に乗らない可能性が高いため、後続フェーズに分ける。

### 翻訳先言語

- 翻訳先言語はユーザー設定として明示的に保持する。
- 初期値は `ja` とする。FeedOwn の主要ユーザー層に合わせた既定値。
- 設定画面に翻訳先言語ドロップダウンを置き、`ja`、`en`、`ko`、`zh` などから選べるようにする。
- デバイスロケールは参照しない。`expo-localization` は導入しない。
- 翻訳機能を無効にしている場合は、翻訳先言語の設定項目も表示しない。
- 翻訳先言語を変えても既存キャッシュは消さない。表示時は現在のターゲット言語のキャッシュを優先する。

### ソース言語の判定

記事のソース言語は次の優先順で判定する。

1. RSS フィードの `language` メタデータ (信頼度低だが手がかり)
2. 簡易ヒューリスティック (日本語かな/カナ含有、ハングル、漢字主体、ASCII 比率)
3. 判定不可の場合は翻訳ボタンを `不明` 表示にする

ソース言語 = ターゲット言語の場合は、翻訳ボタンを表示しない、または `原文と一致しています` 表示にする。LLM 呼び出しは行わない。

LLM ベースの言語判定は使わない。判定だけのために LLM を呼ぶのはコストに見合わない。

### 初期対象

初期対象:

- 要約の翻訳。生成済みの `PerspectiveSummary` をターゲット言語へ翻訳する。

後続対象:

- チャット回答の翻訳
- 信号分離結果の翻訳
- Reader Mode 本文の段落単位翻訳
- 全文翻訳
- 原文・訳文インライン表示

### UX

`ArticleAiPanel` 内で、要約モードに `日本語訳を見る` ボタンを追加する形から始める。独立した `翻訳` タブを設けるかは、UI が散らかるかを見て判断する。

最小UI:

```txt
要点 (English)
- ...
- ...

[日本語訳を見る]
```

翻訳済み:

```txt
要点 (日本語訳)
- ...
- ...

[原文を見る] [再翻訳]
```

ソース言語 = ターゲット言語:

```txt
原文と翻訳先言語が一致しています
```

ソース言語不明:

```txt
言語を判定できません
[日本語に翻訳する]
```

### 出力形式

```ts
type ArticleTranslation = {
  articleId: string;
  source: string;             // 'summary:brief' / 'summary:technical' など
  sourceLanguage: string;     // 'en' / 'ja' / 'unknown'
  targetLanguage: string;     // 'ja' / 'en' / ...
  translated: string[];       // 元が配列なら配列で順序を保持
  generatedAt: string;
  modelId: string;
};
```

要約翻訳では、入力 `summary: string[]` と同じ要素数・同じ順序で `translated` を返すことを前提にする。長さがズレた場合は失敗扱いにし、再生成または原文表示にフォールバックする。

### 出力ルール

LLM プロンプトに含める制約:

- 入力テキストの構造を保つ。元が箇条書きなら箇条書き、見出しなら見出しとして翻訳する。
- コードブロック、URL、メールアドレス、固有名詞 (英語) は翻訳しない。
- 訳文以外の説明、注釈、メタコメントを出力しない。
- JSON で返す。
- 入力が空、または翻訳不要な場合は空配列を返す。

### リスク

- 小型量子化 LLM の翻訳品質は専用翻訳モデル (NLLB, M2M-100) に劣る。
- 技術用語、固有名詞の誤訳。
- 長文では中盤以降を要約・省略してしまう。
- 全文翻訳は出力トークン数が多く、レイテンシが要約の数倍〜10倍になる。
- 日本語入力 → 日本語出力の自己翻訳ループに陥らないよう、ソース言語判定が必要。
- ターゲット言語をユーザーが切り替えた直後に大量の再生成が走らないよう、再翻訳はユーザー操作時のみ。

対策:

- 初期版は要約翻訳のみ。出力短く、リスクを抑える。
- ソース言語 = ターゲット言語の場合はLLMを呼ばない。
- 全文翻訳は段落単位で実行 + キャッシュ。
- Phase 0 で「200字英文 → 日本語訳」を実機で評価し、品質判断。
- 翻訳品質が不足する場合、初期リリースでは「実験機能」として扱うか、要約翻訳のみに限定する。
- ターゲット言語の切り替えは設定画面でのみ可能とし、記事画面からは変更しない (誤操作防止)。

## 機能6: バックグラウンド先回り要約

ユーザーがアプリを開いていない間に、未読記事を端末側 AI で先回りして要約しておく機能。アプリを開いた瞬間に「最新の未読がすでに要約済み」という体験を狙う。要約処理自体は機能1 (視点切り替え要約) のパイプラインをそのまま使い、`brief` 視点の結果を共通キャッシュに書き込む。

バックエンド負荷を抑えるため、1回の実行で叩く API は `/api/refresh` と `/api/articles` の2本のみとし、`/api/article-content` は呼ばない (RSS description のみで要約する)。実装は `expo-background-task` 経由で iOS の `BGProcessingTask`、Android の `WorkManager` を呼び出す。

### 前提タスク: aiCache の 7 日 TTL 改修

機能6 を実装する前に、既存の `aiCache` (機能1〜5 で使用中) に **7 日 TTL ベースの eviction** を入れる必要がある。現状は削除ロジックがなく、容量超過時は `setItem` が静かに失敗するだけで、長期使用で破綻する。

サーバー側の記事 TTL (`functions/api/refresh.ts` 内で `expiresAt = now + 7 日`) と揃える。サーバーに存在しない記事の要約だけが端末に残り続ける問題も同時に解消される。

改修内容:

- `isRecordValid` に「`createdAt` から 7 日経過していたら無効」のチェックを追加 (lazy 失効)
- `aiCache.js` に `sweepExpiredCache()` 関数を追加: `AsyncStorage.getAllKeys()` で `SUMMARY_PREFIX` / `TRANSLATION_PREFIX` のキーを列挙し、`createdAt` が 7 日以上前のものを `multiRemove` で一括削除
- `AiContext` mount 時に `sweepExpiredCache()` を呼ぶ (起動時に 1 回、500〜1000 件規模なら数百 ms)
- インデックスキーは不要 (getAllKeys + filter で十分高速)

これは機能6 専用ではなく、機能1〜5 と機能6 が共通で利用する基盤改修。

### 対象記事

- 未読の新着順で直近 N 件 (デフォルト 20、設定で 5〜50 まで可変)
- 既にキャッシュ済みの記事はスキップ
- 「お気に入りフィードのみ」「全フィード」のような切り分けは初期版では行わない
- 単一フィードが大量に新着を吐いた場合のフィード公平性は考慮しない (新しい順 N 件)

### 実行条件

- OS スケジューラ任せ
- 将来オプションとして「Wi-Fi 接続中のみ」「充電中のみ」のトグル追加を検討するが、初期版には含めない

### 1回の実行予算

- 件数上限 OR wall-clock 時間上限のどちらか到達で終了
- デフォルト: 20 件 または 5 分のいずれか早い方
- ループ冒頭で開始時刻を保持し、各記事生成完了後にチェック
- iOS の `BGTask.expirationHandler` 発火時も同様に安全停止する

### 実行頻度の制御

バックエンド API 呼び出しを抑えるため、頻度を二層でガードする。

- OS レベル: `expo-background-task` 登録時の `minimumInterval` を設定値と同期
- アプリレベル: callback 冒頭で `lastRunAt` を読み、設定値より短ければ即終了
- 設定可能な間隔: 30 分 / 1 時間 / 6 時間 / 12 時間 (デフォルト 30 分)

iOS の `BGProcessingTask` は OS の judgement で発火が決まるため、`minimumInterval` を 30 分に設定しても実際には数時間〜1日に1回程度しか走らないのが普通。これは仕様上避けられないので、設定画面の説明文に明記する。

### データフロー詳細

1 回の task callback 内のシーケンス:

1. 設定読み込み → `enabled` が false なら即終了
2. `lastRunAt` チェック → 最低間隔未満なら即終了
3. ロック取得 (`backgroundSummary.lock = { startedAt }`)
4. `/api/refresh` を **1 バッチだけ** 呼ぶ (offset なし、`while (nextOffset)` ループはしない)
   - 大多数のユーザーは <20 フィードなので 1 バッチでカバーされる想定
   - 多フィードユーザーの場合は一部のフィードが取りこぼされるが、次回 foreground refresh で補完
5. `/api/articles?unreadOnly=true&limit=N` で未読を取得
6. 既にキャッシュ済みの記事を除外
7. `LLMModule.fromModelName(selectedModel.executorchModel)` でモデルロード
8. 各記事ループ (新しい順):
   - `buildArticleContext` (`/api/article-content` は呼ばない、RSS description のみ)
   - `buildBriefSummaryMessages` → `await llm.generate(messages)`
   - JSON パース (失敗時 1 回修復リトライ)
   - `saveSummaryCache(..., { source: 'background' })`
   - 件数 ≥ N または elapsed ≥ timeout → break
9. `llm.delete()` でモデル破棄
10. `lastRunStats` を更新、`history` に push (FIFO で最大 10 件)
11. ロック解除 → `BackgroundTask.setTaskCompleted(.Success)`

### エラー戦略

すべてのエラーは **サイレント** に処理する (自動 OFF・通知・リモートログは一切なし)。Profile 画面の「最終実行」「直近の履歴」表示で観測する。

| エラー種別 | 振る舞い |
|---|---|
| 認証 401 (リフレッシュトークンも失効) | 諦めて次回に持ち越し |
| ネットワーク / 5xx | リトライなし、その回の task をスキップして次回 |
| LLM 推論 JSON パース失敗 (修復リトライもダメ) | 該当 1 件だけスキップして次の記事へ |
| `LLMModule.fromModelName` 失敗 / 予期せぬ例外 | task 中止、errors に記録、次回は普通に試行 |

`errors` 配列の各エントリは `{ articleId?, stage, message }` の形で保持し、`history` 経由で Profile に表示する。

### 中断シーケンスと AppState 遷移

中断のトリガは 3 種類で、すべて共通のクリーンアップハンドラに集約する:

- AppState が `'active'` に変化 (ユーザーがアプリを開いた)
- `BGTask.expirationHandler` 発火 (iOS が時間切れ宣告)
- 件数 / wall-clock 予算超過

共通シーケンス:

1. 生成中なら `llm.interrupt()`
2. 短い settle 待ち (~100ms) — interrupt 後の 1 トークン残り対策
3. `llm.delete()` でモデル破棄
4. 途中まで生成された raw response は捨てる (ExecuTorch は再開不能)
5. `lastRunStats` を保存、`history` に push
6. `backgroundSummary.lock` をクリア (delete 完了後にクリア = 二重メモリ防止)
7. `BackgroundTask.setTaskCompleted(.Success)` で OS に終了通知

`finally` ブロックで包んで、どこで失敗しても 5〜7 は必ず通る。

AppState='active' 遷移時はフォアグラウンドユーザー優先 = メモリを即座に譲る方針。途中まで生成された 1 件は捨てて、次回 background で再試行する。

### AiContext との競合制御

フォアグラウンドで `useLLM` がモデルをメモリに保持している間に background task が `LLMModule` で別インスタンスを作るとメモリが二重になる。

- background task 開始時に AsyncStorage に `backgroundSummary.lock = { startedAt }` を書く
- `AiContext` 起動時にロックを参照し、生きていれば `useLLM` の `preventLoad` を維持
- task 終了 (正常 / `expirationHandler` / 例外 / AppState 遷移) で必ずロック解除 (finally で `lock = null`)
- ロックに古いタイムスタンプ (例: 15 分以上前) があれば停滞ロックと判断して破棄する

### ライフサイクル管理

`AiContext` を register/unregister の単一窓口にする。

- `AiContext` mount 時に `syncBackgroundTask(settings)` を呼ぶ — OS 登録状態と設定値を一致させる
- `updateSettings` 呼び出し後に `syncBackgroundTask(next)` を再度呼ぶ
- `signOut` 内で `BackgroundTask.unregisterTaskAsync()` を呼ぶ (認証情報なしで走らせない)
- AI 機能本体 (機能1〜5) の `enabled` が false / 選択モデルが未ダウンロード / `backgroundSummary.enabled` が false のいずれかでは登録しない
- 間隔設定が変わったら `unregister → register` し直す

```js
async function syncBackgroundTask(settings) {
  const shouldBeRegistered =
    settings.enabled &&
    settings.backgroundSummary.enabled &&
    settings.downloadedModelIds.includes(settings.selectedModelId)

  const registered = await BackgroundTask.getStatusAsync()
  if (shouldBeRegistered && !registered) {
    await BackgroundTask.registerTaskAsync('feedown-summary', {
      minimumInterval: settings.backgroundSummary.minIntervalMinutes,
    })
  } else if (!shouldBeRegistered && registered) {
    await BackgroundTask.unregisterTaskAsync('feedown-summary')
  }
  // 間隔変更時は register し直す処理を追加
}
```

### デフォルト動作

- デフォルト OFF (opt-in)
- AI 機能本体 (機能1〜5) とは独立したトグルを設定画面に置く
- AI 機能本体が OFF のときはトグル自体を表示しない (依存関係)

### iOS 仕様上の前提

- 内部的に `BGProcessingTask` を使用
- 必要な `Info.plist` 設定: `BGTaskSchedulerPermittedIdentifiers` への識別子追加、`UIBackgroundModes` に `processing` を追加
- App Store 提出時の説明文に「未読記事のオンデバイス先読み要約のためにバックグラウンド処理を使用」と明記する
- App Review でフラグが立った場合に備え、Profile 画面で機能の説明と OFF 切り替え手段を明確に提示する

### プライバシー / 開示

- バックグラウンド要約は端末内処理であり、要約結果も AsyncStorage に保存される。外部送信は一切行わない
- ユーザー向けの説明はダイアログを出さず、設定画面の説明テキストのみで行う
- 説明テキスト例: 「未読記事を端末側 AI で先回り要約します。実際の実行頻度は iOS/Android の判断で決まり、通常は数時間〜1日に1回程度です。」
- リモートログ (Sentry / Crashlytics 等) には送信しない

### キャッシュとの関係

- 機能1 (視点切り替え要約) と同じ `aiCache` を使用 (前提タスクで 7 日 TTL を入れた後)
- `perspective: 'brief'` の結果として保存
- フォアグラウンドで記事を開いた際の `useArticleAi` フローがそのままキャッシュを拾う
- ユーザーが手動で別視点を要求した場合は通常通り追加生成する

### 出力形式

機能1 と同じ `PerspectiveSummary` を使用 (`perspective: 'brief'`)。バックグラウンド実行を後から識別できるようにメタデータを1項目追加する。

```ts
type PerspectiveSummary = {
  // 既存フィールド...
  source?: 'foreground' | 'background';
};
```

`source` を観測性 (Profile 画面の「直近の要約件数」表示) と将来の品質比較に使う。

### 観測性 / 実行履歴

- `lastRunStats` (直近 1 回) と `history` (直近 10 回、FIFO) を `backgroundSummary` 設定内に持つ
- リモートログには送らない、端末内のみ

`BackgroundRunStats` のスキーマ:

```ts
type BackgroundRunStats = {
  startedAt: string          // ISO
  durationMs: number
  fetched: number            // /api/articles で取得した数
  attempted: number          // LLM 推論を試みた数
  summarized: number         // 成功した数
  skippedCached: number
  errors: Array<{
    articleId?: string
    stage: 'auth' | 'refresh' | 'list' | 'model-load' | 'inference' | 'parse'
    message: string
  }>
  endedReason: 'completed' | 'limit-articles' | 'limit-time' | 'expiration' | 'app-foreground' | 'error'
}
```

Profile 画面では「最終実行サマリ (X 時間前 / Y 件 / Z 件エラー)」をデフォルト表示し、エラーがあれば赤バッジで強調。「履歴を見る」タップで直近 10 回の一覧を展開表示。

### 設定画面

「On-Device AI」セクション内に「バックグラウンド先回り要約」サブセクションを追加する。

- トグル: 「未読記事を端末側 AI で先回り要約」(デフォルト OFF)
- 説明テキスト: 「実際の実行頻度は iOS/Android の判断で決まります。通常は数時間〜1日に1回程度です。」
- 数値入力: 最大件数 (5〜50、デフォルト 20)
- 数値入力: 最大時間 (1〜10 分、デフォルト 5)
- ドロップダウン: 最低間隔 (30 分 / 1 時間 / 6 時間 / 12 時間、デフォルト 30 分)
- 最終実行表示: 「最終実行: X 時間前 / 要約 Y 件 / エラー Z 件」 (エラーがあれば赤バッジ)
- 「履歴を見る」展開: 直近 10 回のリスト
- `__DEV__` 時のみ表示: 「今すぐ実行」ボタン (task callback と同一ロジックを foreground で起動、デバッグ用)

### テスト戦略

- iOS 実機: Xcode のデバッガコンソールで `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"feedown-summary"]` で発火
- Android 実機/エミュ: `adb shell cmd jobscheduler run -f com.feedown.app <jobId>` で発火
- 開発ビルド: Profile の dev only「今すぐ実行」ボタンで foreground 実行 (OS スケジューラを介さず、task callback ロジックを直接呼ぶ)
- E2E 確認項目:
  - 認証切れ時に `lastRunStats` に記録され、次回も試行されること
  - AppState='active' 遷移時に即中断されること
  - 件数上限・時間上限・expiration の 3 経路で同じクリーンアップが走ること
  - `aiCache` の 7 日 TTL sweep が起動時に動くこと

### リスク

- iOS の発火頻度が想定より低く、「先回り済みになっていない」体験になる可能性
- バックグラウンド推論によるバッテリー消費が体感できるレベルになる可能性
- Cold-load 時間が長く、1 回の予算で 1〜2 件しか処理できないケース
- 認証トークンが切れている場合の無音失敗 (Profile の「最終実行」表示で気づけるようにする)

### 追加パッケージ

```bash
yarn workspace mobile add expo-background-task
```

### 追加するファイル

```
apps/mobile/src/ai/backgroundSummary.js     # task callback 本体 + 共通クリーンアップハンドラ
apps/mobile/src/ai/backgroundTaskSetup.js   # syncBackgroundTask (register/unregister)
```

### 修正するファイル

```
apps/mobile/src/ai/aiCache.js                # 7 日 TTL + sweepExpiredCache 追加 (前提タスク)
apps/mobile/src/ai/aiStorage.js              # backgroundSummary 設定 + history 追加
apps/mobile/src/contexts/AiContext.js        # ロック制御 + mount 時 sync / sweep
apps/mobile/src/contexts/UserContext.js      # signOut 時に unregister
apps/mobile/src/scenes/profile/Profile.js    # 設定 UI + 履歴表示 + dev only ボタン
apps/mobile/App.js                           # 起動時に task 登録
apps/mobile/app.config.js                    # iOS BGTaskSchedulerPermittedIdentifiers / UIBackgroundModes
```

### 未確定 (実装時に検証)

- `expo-background-task` の `BGProcessingTask` モードで 5 分の実行予算が取れるか実機検証
- 選択モデル (LFM2.5-1.2B など) の cold-load 実測時間
- `ExpoResourceFetcher` がローカルキャッシュ済みモデルを background context で参照できるか
- `useLLM` と `LLMModule` の二重インスタンス時のメモリ挙動 (ロック機構の妥当性検証)
- AppState='active' 遷移を JS 層で検知してから interrupt まで何 ms 必要か (体感速度に直結)

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
  translationService.js
  languageDetect.js
  ttsService.js
  aiCache.js
  useArticleAi.js

apps/mobile/src/components/article/
  ArticleAiPanel.js
  PerspectiveSummaryView.js
  ArticleSignalsView.js
  ArticleChatView.js
  ArticleTranslationView.js
  ArticleReadAloudControls.js
```

責務:

- `initExecutorch.js`: ExecuTorch の初期化。
- `models.js`: 使用するモデル定義、モデルID、対応機能の管理。
- `prompts.js`: プロンプト生成とJSON出力指示。
- `summaryService.js`: 視点切り替え要約の生成。
- `signalService.js`: 信号分離結果の生成。
- `chatService.js`: 単一記事チャットの回答生成。
- `translationService.js`: 要約や記事本文の翻訳生成。
- `languageDetect.js`: ソース言語の簡易ヒューリスティック判定。
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

- `feature`: `summary`、`signals`、`chat`、`translation`
- `mode`:
  - 要約: 視点 (`brief` / `technical` / `critical`)
  - 信号分離: `default`
  - 翻訳: `${sourceFeature}:${sourceMode}:${targetLanguage}` (例: `summary:brief:ja`)
- `contentHash`: 記事タイトル、RSS本文、Reader Mode本文が変わった場合に変わる値

翻訳キャッシュは「翻訳元の生成結果」とは別レコードとして保存する。要約を再生成すると翻訳キャッシュは整合性を失うため、要約再生成時に対応する翻訳キャッシュを削除する。

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

初期検証では、`useLLM` で使用できるライブラリ提供モデルのうち、モバイル実機で現実的に試しやすい量子化モデルを候補にする。
自前変換モデルや任意URL指定モデルは扱わない。

```ts
import {
  LFM2_5_350M_QUANTIZED,
  LFM2_5_1_2B_INSTRUCT_QUANTIZED,
  QWEN3_0_6B_QUANTIZED,
  QWEN3_1_7B_QUANTIZED,
  QWEN2_5_1_5B_QUANTIZED,
  SMOLLM2_1_360M_QUANTIZED,
} from 'react-native-executorch';
```

使い分け:

- `LFM2_5_1_2B_INSTRUCT_QUANTIZED`: 初期おすすめ。要約、信号分離、記事チャットのバランス検証用。
- `QWEN3_0_6B_QUANTIZED`: 日本語記事、短い要約、低めの負荷を比較する候補。
- `QWEN3_1_7B_QUANTIZED`: 日本語記事や指示追従の比較候補。端末負荷は高めとして扱う。
- `QWEN2_5_1_5B_QUANTIZED`: Qwen 3 と比較する互換候補。実機で安定性を確認する。
- `LFM2_5_350M_QUANTIZED`: 低容量・低負荷フォールバック候補。
- `SMOLLM2_1_360M_QUANTIZED`: 最軽量寄りのフォールバック候補。品質より起動性と安定性を検証する。

初期リリースでも、ユーザーが候補からLLMモデルを選べるようにする。
ただし、選択肢は FeedOwn 側でキュレーションした数件に限定し、`useLLM` が提供する全モデルをそのまま一覧表示しない。
設定画面ではモデルの内部定数名ではなく、用途と負荷が分かる表示名を出す。
内部実装では `models.js` に候補一覧、既定モデル、モデルID、対応機能、推定サイズ、推奨度、注意書きを集約する。

```ts
export const FEEDOWN_DEFAULT_LLM_ID = 'lfm2_5_1_2b_instruct_quantized';

export const FEEDOWN_LLM_MODELS = [
  {
    id: 'lfm2_5_1_2b_instruct_quantized',
    displayName: 'FeedOwn Local Reader',
    model: LFM2_5_1_2B_INSTRUCT_QUANTIZED,
    recommendation: 'recommended',
    profile: 'balanced',
    features: ['summary', 'signals', 'chat', 'translation'],
    notes: '最初に試す標準モデル。品質と負荷のバランスを見る。',
  },
  {
    id: 'qwen3_0_6b_quantized',
    displayName: 'FeedOwn Local Reader Lite JP',
    model: QWEN3_0_6B_QUANTIZED,
    recommendation: 'candidate',
    profile: 'light_japanese',
    features: ['summary', 'signals', 'chat', 'translation'],
    notes: '日本語記事の軽量候補。短い記事と要約で比較する。',
  },
  {
    id: 'qwen3_1_7b_quantized',
    displayName: 'FeedOwn Local Reader JP',
    model: QWEN3_1_7B_QUANTIZED,
    recommendation: 'candidate',
    profile: 'japanese_quality',
    features: ['summary', 'signals', 'chat', 'translation'],
    notes: '日本語と指示追従の比較候補。端末負荷は高め。',
  },
  {
    id: 'lfm2_5_350m_quantized',
    displayName: 'FeedOwn Local Reader Mini',
    model: LFM2_5_350M_QUANTIZED,
    recommendation: 'fallback',
    profile: 'low_memory',
    features: ['summary'],
    notes: '低メモリ端末向け。記事チャットと翻訳は品質検証後に有効化する。',
  },
];
```

モデル選択UIの初期表示は、既定モデルを選択済みにする。
ユーザーが別モデルを選んだ場合は、選択だけではダウンロードを開始しない。
「このモデルをダウンロード」または「このモデルに切り替える」の明示操作で、モデル準備を開始する。

複数モデルを端末内に保持できるようにするが、同時にロードするLLMは1つだけにする。
切り替え時は現在ロード中のLLMを解放し、選択先モデルをロードし直す。
未ダウンロードのモデルへ切り替える場合は、先にダウンロード確認画面を出す。
ストレージ不足を避けるため、モデルごとに削除操作を用意し、推定使用容量と実使用容量を表示する。

### モデル状態

LLMモデルは、モデルIDごとに以下の状態で管理する。
グローバルには `selectedLlmModelId` を1つ持ち、記事要約、信号分離、記事チャットは常に現在選択中のモデルを使う。

```ts
type AiModelStatus =
  | 'unsupported'
  | 'not_downloaded'
  | 'downloading'
  | 'paused'
  | 'ready'
  | 'update_available'
  | 'error';

type LlmModelState = {
  modelId: string;
  status: AiModelStatus;
  downloadProgress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  lastUsedAt?: string;
  errorMessage?: string;
};

type LlmModelSelection = {
  selectedLlmModelId: string;
  modelStates: Record<string, LlmModelState>;
};
```

状態の意味:

- `unsupported`: OS、端末、React Native構成が非対応。
- `not_downloaded`: モデル未ダウンロード。
- `downloading`: モデルをダウンロード中。
- `paused`: ダウンロード一時停止中。
- `ready`: モデル使用可能。
- `update_available`: 既存モデルは使えるが、新しいモデル定義がある。
- `error`: ダウンロード、読み込み、初期化に失敗。

モデル切り替え時の扱い:

- `ready` のモデルへ切り替える場合は、選択状態を更新し、次回AI実行時にそのモデルをロードする。
- 現在別モデルがロード済みなら、切り替え前に解放する。
- `not_downloaded` のモデルへ切り替える場合は、選択前にダウンロード確認を出す。
- `downloading` のモデルは選択予約できるが、AI実行には使えない。
- `error` のモデルは再試行または削除を表示する。
- 生成結果キャッシュのキーには `modelId` とモデル定義バージョンを含める。モデルを切り替えたら、同じ記事でも別キャッシュとして扱う。

### 設定画面

`設定 > オンデバイスAI` にモデル管理画面を追加する。

表示項目:

- AI読書支援の有効/無効
- 選択中のLLMモデル
- 候補LLMモデル一覧
- モデルごとの状態
- 表示名
- 推奨ラベル
- 負荷目安
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
選択中: FeedOwn Local Reader
要約・信号分離・記事チャット
状態: 使用可能

モデル候補

(*) FeedOwn Local Reader
    おすすめ / バランス重視
    状態: 使用可能
    [使用中] [削除]

( ) FeedOwn Local Reader Lite JP
    日本語軽量候補
    状態: 未ダウンロード
    [ダウンロード]

( ) FeedOwn Local Reader JP
    日本語品質候補 / 高負荷
    状態: 未ダウンロード
    [ダウンロード]

( ) FeedOwn Local Reader Mini
    低メモリ端末向け
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
FeedOwn Local Reader Lite JP
状態: ダウンロード中 42%

[==========              ]
残り 約 8分

[一時停止] [キャンセル]
```

切り替え確認:

```txt
LLMモデルを切り替えますか？

現在: FeedOwn Local Reader
変更後: FeedOwn Local Reader Lite JP

切り替え後に生成する要約、信号分離、記事チャットは新しいモデルを使います。
既存の生成結果は削除されません。

[切り替える] [キャンセル]
```

### 記事画面からの導線

記事詳細でAI機能を開いたとき、選択中のLLMモデルが未ダウンロードなら、AIパネル内に準備導線を表示する。
他に `ready` のLLMモデルがある場合は、そのモデルへ切り替える導線も表示する。

```txt
AIモデルがまだありません

要約、信号分離、記事チャットを端末内で使うには
選択中モデルのダウンロードが必要です。

選択中: FeedOwn Local Reader Lite JP
サイズ: 未確定または約 xxx MB
[モデルを準備]
[使用可能なモデルに切り替える]
```

`モデルを準備` は、設定画面に遷移するか、初回だけ下部シートでダウンロード確認を出す。どちらの場合も、ユーザー確認なしにダウンロードを開始しない。

### 実装ルール

- 初回ダウンロードはユーザー操作で開始する。
- ダウンロード前にサイズと通信量の目安を表示する。
- デフォルトではWi-Fi時のみダウンロードする。
- モデルはモデルごとに削除できるようにする。
- モデル選択だけではダウンロードしない。
- `ready` のモデルが複数ある場合、ユーザーは設定画面でいつでも切り替えられる。
- 切り替え後のAI実行は新しいモデルを使う。既存の生成結果は消さない。
- 非対応端末ではAI機能を無効化し、通常の記事閲覧は維持する。
- モデルがなくても、記事閲覧、既読、お気に入り、共有は通常通り動く。
- LLMモデルとTTSモデルは別々に管理する。

## モデル方針

最初は、現在の iOS / Android 実機で安定して動く小さめの ready-made LLM を複数候補として用意する。
初期版でもモデル選択UIを出すが、選択肢は FeedOwn が検証対象として絞った `useLLM` 対応モデルだけにする。
ユーザーには内部定数名ではなく、`おすすめ`、`日本語軽量`、`日本語品質`、`低メモリ` のような用途ラベルで提示する。

評価基準:

- 対応実機でクラッシュしない。
- 構造化JSONをある程度安定して出力できる。
- 1記事あたりの生成時間が許容範囲内。
- モデルダウンロードサイズが大きすぎない。
- 初回ダウンロード後はオフラインで動く。
- モデルを切り替えても既存の生成結果や記事閲覧が壊れない。

フォールバック:

- モデル初期化に失敗したら、AI操作を無効化し、設定画面またはAIパネルに診断表示を出す。
- 選択中モデルが失敗した場合、ダウンロード済みの別モデルがあれば切り替えを提案する。
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

### Phase 4.5: 要約翻訳

- `translationService.js` を追加する。
- `languageDetect.js` を追加し、簡易ヒューリスティックでソース言語を判定する。
- 翻訳先言語の設定項目を追加する。初期値は `ja`。
- 要約モードに `日本語訳を見る` ボタンを追加する。
- 翻訳結果のキャッシュを実装する。
- ソース言語 = ターゲット言語の判定で LLM 呼び出しをスキップする。
- 翻訳元の要約を再生成した場合に翻訳キャッシュを無効化する。

Phase 0 で要約翻訳が実用品質に達しないと判明した場合は、Phase 4.5 を保留しチャット (Phase 5) を先行する。

完了条件:

- 英語要約をターゲット言語へ翻訳できる。
- ソース言語と翻訳先言語が一致する記事では翻訳ボタンを出さない。
- 翻訳キャッシュが要約再生成時に整合性を保てる。
- 翻訳失敗時に通常の要約表示が壊れない。

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

### Phase 9: 本文翻訳検討

要約翻訳が安定した後、Reader Mode 本文や信号分離結果・チャット回答の翻訳を検討する。

必要になる基盤:

- 段落単位の本文分割と翻訳
- 段落ごとの翻訳キャッシュ
- 進捗表示 (3/12 段落完了 など)
- 中断・再開可能な処理
- 原文・訳文の切り替え表示、または対訳表示
- コードブロック・URL・引用の保護

この段階でも、まずは「ユーザーが翻訳ボタンを押した記事」だけを対象にする。フィード一括翻訳や事前翻訳は対象外。

## テスト計画

ユニットテスト:

- プロンプトに必要なJSONスキーマ指示が含まれる。
- 記事本文が変わるとキャッシュキーが変わる。
- 選択中LLMモデルが変わるとキャッシュキーが変わる。
- 保存済み `selectedModelId` が候補一覧にない場合、既定モデルへ補正される。
- パーサが正しいJSONを受け付け、不正なレスポンスを拒否する。
- 修復リトライが一般的な出力崩れに対応できる。
- 記事チャットが記事外の質問に対して「この記事だけでは不明」を返せる。
- TTSサービスが短いテキストから音声生成を開始できる。
- LLMモデルとTTSモデルの状態を別々に扱える。
- LLMモデルごとの `not_downloaded`、`downloading`、`ready`、`error` を別々に扱える。
- `languageDetect` が日本語、英語、混在テキストを区別できる。
- 翻訳キャッシュキーがターゲット言語と翻訳元 (`source`、`sourceHash`) で変わる。
- ソース言語 = ターゲット言語のとき、翻訳サービスが LLM を呼ばずに済む。
- 翻訳出力の要素数が入力と一致しない場合、修復リトライ後に失敗扱いになる。
- 要約再生成で `sourceHash` が変わると、対応する翻訳キャッシュが無効化される。

手動テスト:

- iOS 17 以上の物理端末。
- Android 13 以上の物理端末。
- Reader Mode 本文がある長い記事。
- RSS description だけの短い記事。
- モデルダウンロード後のオフライン動作。
- 複数LLMモデルのダウンロード。
- ダウンロード済みLLMモデル間の切り替え。
- 未ダウンロードLLMモデルを選んだときに確認なしでダウンロードが始まらないこと。
- アプリ再起動後のキャッシュ復元。
- ストレージ不足またはモデルダウンロード失敗。
- 記事チャットで短い質問を連続して送る。
- 記事にない内容を質問する。
- 要約読み上げを再生、停止する。
- 読み上げ速度を変更する。
- TTSモデル未ダウンロード状態で読み上げボタンを押す。
- 英語要約を日本語に翻訳する。
- 日本語記事で翻訳ボタンが「原文と一致」表示になる。
- ソース言語不明な記事で翻訳ボタンを押す。
- 翻訳先言語を切り替えた後、別記事で再翻訳を実行する。
- 要約再生成後に翻訳キャッシュが無効化されることを確認する。

回帰確認:

- AI初期化に失敗しても記事閲覧は動く。
- お気に入り、既読、共有操作に影響しない。
- ダークモードとフォントサイズ設定が AI パネル周辺でも崩れない。
- TTS初期化に失敗しても要約、信号分離、記事チャット、翻訳は動く。
- 翻訳機能を無効にしている場合、要約・信号分離・チャットは通常通り動く。

## 未決事項

- 最初の検証に使う ready-made model はどれにするか。
- モデルダウンロードは初回AI操作時に行うか、設定画面で明示的に行うか。
- 初期版では、お気に入り記事または保存済み記事だけをAI対象にするか。
- 7日TTLで記事が消えるとき、AI生成結果も削除するか。
- 意味検索を近いうちに入れるなら、最初から SQLite を使うべきか。
- 記事チャット履歴は記事を閉じたら破棄するか、短期間保存するか。
- 初期TTS対象を要約だけにするか、記事チャット回答も含めるか。
- 日本語読み上げ品質が不足する場合、機能表示をどう制限するか。
- 翻訳に汎用 LLM を流用するか、専用翻訳モデル (NLLB / M2M-100 系) を別途検討するか。Phase 0 の品質評価次第で決定する。
- 翻訳機能の対象言語を初期から `ja` / `en` / `ko` / `zh` の 4 つに広げるか、初期は `ja` ⇄ `en` のみにするか。
- ソース言語のヒューリスティック判定が失敗した場合、翻訳ボタンを隠すか、ユーザーに言語を選ばせるか。
- 翻訳元 (要約) を再生成した時、翻訳結果も自動再生成するか、ユーザー操作で再生成させるか。

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
- 翻訳設定
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

選択中: FeedOwn Local Reader

(*) FeedOwn Local Reader
    おすすめ / バランス重視
    用途: 要約・信号分離・記事チャット
    状態: 使用可能
    [使用中] [削除]

( ) FeedOwn Local Reader Lite JP
    日本語軽量候補
    用途: 要約・信号分離・記事チャット
    状態: 未ダウンロード
    [ダウンロード]

( ) FeedOwn Local Reader Mini
    低メモリ端末向け
    用途: 要約
    状態: 未ダウンロード
    [ダウンロード]

[モデル候補を更新]
```

翻訳設定:

```txt
翻訳設定

[ ] 翻訳機能を有効にする

翻訳先言語
( ) 日本語
( ) English
( ) 한국어
( ) 中文

記事のソース言語が翻訳先と異なる場合のみ翻訳ボタンを表示します。
翻訳には選択中のLLMモデルを使います。
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
選択中のLLMモデルを端末内で使うにはモデルの準備が必要です。

[モデルを準備]
[別のモデルを選ぶ]
```

モデル準備済み:

```txt
AI
[要約] [信号] [チャット]

[要点] [技術者向け] [批判的]

[生成]
```

生成済み (英語記事 / 翻訳機能ON):

```txt
AI
[要約] [信号] [チャット]

要点 (English)
- ...
- ...
- ...

[再生成] [読み上げ] [日本語訳を見る]
```

翻訳済み:

```txt
AI
[要約] [信号] [チャット]

要点 (日本語訳)
- ...
- ...
- ...

[原文を見る] [再翻訳] [読み上げ]
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
LLM は複数候補を扱うため、選択中モデルIDとモデルごとの状態を分けて保存する。

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

type LocalLlmSettings = {
  selectedModelId: string;
  modelStates: Record<string, LocalAiModelState>;
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
- LLMの `ready` はモデルIDごとの状態であり、選択中モデルが `ready` とは限らない。
- 選択中モデルを削除した場合は、別の `ready` モデルがあればそれを選択候補として提示する。なければ既定モデルを選択中に戻し、状態は `not_downloaded` とする。
- モデル定義を追加・削除した場合に備え、保存済み `selectedModelId` が候補一覧に存在しないケースを起動時に補正する。

### AIジョブ状態

要約、信号分離、チャット、翻訳、読み上げは同時に多数走らせない。

```ts
type AiJobType = 'summary' | 'signals' | 'chat' | 'translation' | 'tts';

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
const AI_TRANSLATION_CACHE_PREFIX = 'feedown:ai:translation:';
const AI_TRANSLATION_SETTINGS_KEY = 'feedown:ai:translation-settings';
const AI_TTS_SETTINGS_KEY = 'feedown:ai:tts-settings';
```

要約キャッシュ:

```ts
type SummaryCacheRecord = {
  cacheVersion: 1;
  articleId: string;
  contentHash: string;
  modelId: string;
  modelDefinitionVersion: string;
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
  modelId: string;
  modelDefinitionVersion: string;
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
  modelId: string;
  modelDefinitionVersion: string;
  messages: ArticleChatMessage[];
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
};
```

翻訳キャッシュ:

```ts
type TranslationCacheRecord = {
  cacheVersion: 1;
  articleId: string;
  contentHash: string;
  modelId: string;
  modelDefinitionVersion: string;
  source: string;             // 'summary:brief' など、翻訳元の特定子
  sourceHash: string;         // 翻訳元テキストのハッシュ。翻訳元再生成時の整合性検出に使う
  sourceLanguage: string;
  targetLanguage: string;
  result: ArticleTranslation;
  createdAt: string;
  expiresAt?: string;
};
```

翻訳設定:

```ts
type TranslationSettings = {
  enabled: boolean;
  targetLanguage: 'ja' | 'en' | 'ko' | 'zh';  // 初期値 'ja'
};
```

削除ルール:

- 記事がTTLで消える場合、AIキャッシュも削除対象にする。
- ユーザーが「全データ削除」を実行した場合、AI設定以外の生成結果を削除する。
- ユーザーが「AIデータ削除」を実行した場合、要約、信号分離、チャット履歴、翻訳キャッシュ、TTS一時データを削除する。
- モデル削除は生成結果削除とは別操作にする。
- モデルを切り替えても既存キャッシュは残す。表示時は現在選択中の `modelId` と一致するキャッシュを優先し、別モデルの結果は「別モデルで生成済み」として再生成候補にする。
- 翻訳元 (要約・信号分離など) を再生成した場合、`sourceHash` が一致しなくなった翻訳キャッシュを破棄する。
- 翻訳先言語をユーザーが切り替えても既存キャッシュは消さない。新しい言語のキャッシュが無ければユーザー操作時に生成する。

## プロンプト設計

### 共通ルール

すべてのLLMプロンプトに含めるルール:

- 入力記事に基づいて回答する。
- 記事にないことは推測として分ける。
- 不明な場合は不明と答える。
- JSONだけを返す。
- JSON全体をMarkdown文書として返さない。本文フィールド内では、箇条書き、太字、リンク程度の限定Markdownだけを許可する。
- 長い引用を避ける。
- 翻訳機能以外では、出力言語はユーザーの設定 (翻訳先言語) に合わせる。初期値は日本語。
- 翻訳機能では、入力言語と出力言語をプロンプトで明示する。記事の主言語に引きずられない。

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

### 翻訳プロンプト

入力:

- 翻訳元テキストの配列 (`string[]`)
- ソース言語 (`en` / `ja` / ... または `unknown`)
- ターゲット言語

出力:

```json
{
  "translated": ["...", "..."]
}
```

制約:

- 入力配列と同じ要素数・同じ順序で訳文を返す。
- 訳文以外の説明、注釈、メタコメントを出力しない。
- コードブロック、URL、メールアドレス、英語固有名詞は翻訳しない。
- 元が箇条書きなら箇条書きとして自然な訳にする。改行や記号を勝手に追加しない。
- ソース言語 = ターゲット言語の場合はプロンプト呼び出し前に弾く。LLMには渡さない。
- 入力テキストが極端に短い (10字未満) 場合や明らかに翻訳不要な場合は空配列を返してよい。

要素数チェック:

- 出力配列の要素数が入力と一致しない場合、修復リトライ 1 回。それでも一致しなければ失敗扱い。
- ユーザーには「翻訳できませんでした」を表示し、原文表示にフォールバックする。

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
- ユーザーが対象モデルを選び、明示的に開始した。
- Wi-Fi制限が有効な場合はWi-Fi接続中である。
- 同時に別LLMモデルをダウンロードしていない。
- 選択中モデル以外もダウンロードできるが、ダウンロード完了だけでは自動切り替えしない。

### LLMモデル切り替え

切り替え条件:

- 切り替え先モデルが `ready` である。
- LLM生成ジョブが実行中ではない。
- 現在ロード中のLLMがあれば解放できる。

切り替え手順:

1. ユーザーがモデル候補から `ready` のモデルを選ぶ。
2. 確認ダイアログを表示する。
3. `selectedModelId` を更新する。
4. 既存のLLMインスタンスを解放する。
5. 次回AI実行時に選択中モデルをロードする。

未ダウンロードモデルを選んだ場合:

- すぐには切り替えない。
- ダウンロード確認を出す。
- ダウンロード完了後に「このモデルに切り替える」を表示する。

実行中ジョブがある場合:

- 要約、信号分離、記事チャット生成中は切り替えを無効化する。
- どうしても切り替える場合は、先に生成をキャンセルする確認を出す。

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
- LLM切り替え時間
- 要約生成時間
- チャット初回回答時間
- 信号分離生成時間
- 要約翻訳時間
- TTS初回音声までの時間
- ピークメモリ
- アプリクラッシュ有無
- バッテリー消費の体感

目標値の初期案 (Phase 0 の実機実測で更新する):

| 指標 | 目標 |
| --- | --- |
| 要約生成 | 30秒以内 |
| 信号分離 | 45秒以内 |
| チャット回答 | 30秒以内 |
| 要約翻訳 (短文) | 20秒以内 |
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
- `useLLM` で使う候補モデル一覧、既定モデル、表示名、推奨ラベル、負荷目安を定義する。
- LLMは `selectedModelId` とモデルごとの状態をAsyncStorageへ保存する。
- TTSの状態をAsyncStorageへ保存する。
- 設定画面にオンデバイスAIセクションを追加する。
- ダウンロード進捗UIを作る。
- LLMモデル選択、切り替え、削除UIを作る。

成果物:

- モデル未ダウンロード、ダウンロード中、使用可能、エラーがUIで確認できる。
- ダウンロード済みLLMモデルへ切り替えられる。
- 未ダウンロードLLMモデルは確認後にダウンロードできる。

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
- 選択中の `modelId` から `useLLM` 用モデル定数を解決する。
- モデル切り替え時に既存LLMインスタンスを解放し、次回実行で選択中モデルをロードする。

成果物:

- UIなしで要約、信号分離、チャット回答を生成できる。
- 複数の候補モデルで同じ記事の要約を試せる。

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
| Markdown表示 | `react-native-enriched-markdown` | `yarn workspace mobile add react-native-enriched-markdown` | AIの説明文、要約、チャット回答のMarkdown描画に使う |

### 導入しないと決めたもの

| 用途 | パッケージ | 理由 |
| --- | --- | --- |
| デバイスロケール取得 | `expo-localization` | 翻訳先言語はユーザー設定として明示で持つ方針。デバイスロケール参照は不要。エンジニア端末は英語ロケールでも日本語訳を読みたいケースが多く、ロケール自動追従は誤動作の元になる。 |
| 旧Audio API | `expo-av` | Expo の方針として非推奨。`expo-audio` / `expo-video` に分離されたので新規導入しない。 |

### 追加コマンド案

初期スパイク:

```bash
yarn workspace mobile add react-native-executorch react-native-executorch-expo-resource-fetcher
yarn workspace mobile add react-native-gifted-chat
yarn workspace mobile add react-native-enriched-markdown
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

### react-native-enriched-markdown の利用方針

AI出力のMarkdown描画には `react-native-enriched-markdown` を採用する。

利用箇所:

- `PerspectiveSummaryView`: 要約本文、注意点、補足の表示。
- `ArticleSignalsView`: 信号分離結果の説明文や根拠の表示。
- `ArticleChatView`: assistant の回答本文。
- `ArticleAiPanel`: モデル未準備、エラー詳細、診断補足など、短い説明文の表示。

基本方針:

- LLMの一次出力は引き続き構造化JSONを要求する。
- JSONの各フィールドに入った説明文だけをMarkdownとして描画する。
- LLMに自由なMarkdown文書全体を返させる設計にはしない。
- 見出し、箇条書き、太字、リンク程度に用途を絞る。
- 画像、HTML、任意埋め込み、危険なリンクスキームは表示しない。
- 長い引用や記事本文の大量再掲はプロンプト側で禁止する。

チャットでの扱い:

- `react-native-gifted-chat` の bubble 内で assistant メッセージだけ `react-native-enriched-markdown` を使って描画する。
- user メッセージは通常のテキスト表示でよい。
- Markdown描画が重い場合は、チャット回答だけ通常テキストにフォールバックできるようにする。

実装メモ:

- ダークモード用の本文色、リンク色、コード背景色を既存の `ThemeContext` に合わせる。
- Reader Mode のフォントサイズ設定をAI出力にも反映する。
- Markdown描画コンポーネントは `AiMarkdownText.js` のように小さく包み、各画面で直接ライブラリAPIに依存しない。

## 実装引き継ぎチェックリスト

この章は、別セッションや別担当者がこのドキュメントだけを見て実装に入るための作業手順である。最初の実装では、すべてを一度に完成させない。まずは「モデル管理 + 単一記事の要約生成」までを通す。

### 実装前提

- 対象は `apps/mobile`。
- 初期実装はモバイル限定。
- Web版には手を入れない。
- 自前変換モデルは使わない。
- `react-native-executorch` が提供するモデル定数のみを使う。
- LLMは `useLLM` 対応モデルから複数候補を提示し、ユーザーが選択・切り替えできるようにする。
- 既定のユーザー向けモデル名は `FeedOwn Local Reader` とする。
- 候補モデルは `FeedOwn Local Reader`、`FeedOwn Local Reader Lite JP`、`FeedOwn Local Reader JP`、`FeedOwn Local Reader Mini` などの表示名で出す。
- まずは要約だけを動かし、その後に信号分離、翻訳、記事チャット、TTSを追加する。
- `expo-sqlite` は依存として追加してよいが、初期要約実装では使わない。
- AI生成結果は初期版では Supabase に同期しない。
- 翻訳機能の翻訳先言語はユーザー設定として明示で保持する。デバイスロケールは参照しない。`expo-localization` は導入しない。
- 翻訳先言語の初期値は `ja`。

### Step 1: 依存追加

状態: 完了。

現在の `apps/mobile/package.json` では、以下が追加済み。

- `react-native-executorch`
- `react-native-executorch-expo-resource-fetcher`
- `react-native-gifted-chat`
- `react-native-enriched-markdown`
- `expo-dev-client`
- `expo-audio`
- `expo-video`
- `expo-clipboard`
- `expo-haptics`
- `expo-linking`
- `expo-notifications`
- `expo-sqlite`
- `expo-file-system`
- `expo-asset`
- `expo-network`
- `expo-device`

このステップは再実行しない。
今後依存を追加する場合は、必ず root から `yarn workspace mobile ...` または `yarn workspace mobile expo install ...` を使う。

作業ディレクトリ:

```bash
C:\Users\all\develop\expo\feedown
```

追加コマンド:

```bash
yarn workspace mobile add react-native-executorch react-native-executorch-expo-resource-fetcher
yarn workspace mobile add react-native-gifted-chat
yarn workspace mobile add react-native-enriched-markdown
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

状態: 完了。

現在の `apps/mobile/app.json` では `newArchEnabled: true` が設定済み。
`expo-dev-client` も導入済みで、dev client ビルドは完了済み。
以降は Expo Go ではなく dev client / EAS build 前提でJS実装を進める。

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

状態: 次に着手する。

`apps/mobile/src/ai/` はまだ存在しないため、このステップからJS実装を開始する。
既存コードでは、記事詳細は `apps/mobile/src/scenes/article/ArticleDetail.js`、設定画面は `apps/mobile/src/scenes/profile/Profile.js`、Reader Mode本文表示は `apps/mobile/src/components/ArticleReader.js` にある。
AI基盤はこれらへ直接大きく書かず、`src/ai` と小さなUIコンポーネントに分ける。

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
apps/mobile/src/ai/translationService.js
apps/mobile/src/ai/languageDetect.js
apps/mobile/src/ai/chatService.js
apps/mobile/src/ai/ttsService.js
apps/mobile/src/ai/modelState.js
```

初期実装の役割:

- `models.js`: `FEEDOWN_DEFAULT_LLM_ID`、`FEEDOWN_LLM_MODELS`、モデルIDから `useLLM` 用モデル定数を引く関数を定義する。
- `aiStorage.js`: AsyncStorage ベースのAI設定/キャッシュ保存。
- `articleContext.js`: 記事データからLLM入力用テキストを作る。
- `prompts.js`: 要約プロンプトを作る。
- `jsonOutput.js`: JSONパースと簡易バリデーション。
- `summaryService.js`: LLMで要約を生成する。
- `useArticleAi.js`: UIから使う状態管理hook。

完了条件:

- UIなしで記事データから `ArticleAiContext` を作れる。
- 要約用プロンプトを生成できる。
- `modelId` を含むキャッシュキーを生成できる。

### Step 4: モデル管理UIを設定画面に追加

既存の候補ファイル:

```txt
apps/mobile/src/scenes/profile/Profile.js
apps/mobile/src/contexts/ThemeContext.js
apps/mobile/src/utils/storage.js
apps/mobile/src/components/ScreenTemplate.js
```

実装方針:

- 既存アプリでは設定系UIが `Profile.js` にまとまっている。
- まず `Profile.js` の `Reader` セクションと `Statistics` セクションの間に「オンデバイスAI」セクションを追加する。
- 大きくなりすぎる場合は `apps/mobile/src/scenes/profile/OnDeviceAiSettings.js` を新規作成する。
- ダークモードとフォントサイズ設定は既存の `ThemeContext` に合わせる。

表示する状態:

- AI読書支援の有効/無効
- 選択中のLLMモデル
- LLMモデル候補一覧
- LLMモデルごとの状態
- TTSモデル状態
- Wi-Fi時のみダウンロード
- モバイル通信許可
- モデルごとのダウンロード/切り替え/削除
- 診断情報

初期版で実装してよい最小UI:

- LLMモデル選択リスト
- 選択中モデルの状態表示
- モデルごとのダウンロード/切り替え/削除ボタン
- Wi-Fi時のみダウンロード設定
- 非対応端末表示

完了条件:

- 設定画面でAIモデル状態をモデルごとに確認できる。
- 未ダウンロード状態で「ダウンロード」導線が見える。
- `ready` のLLMモデルへ切り替えられる。
- 未ダウンロードのLLMモデルを選んでも、確認なしにダウンロードが始まらない。
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
apps/mobile/src/components/AiMarkdownText.js
apps/mobile/src/components/PerspectiveSummaryView.js
```

実装方針:

- `ArticleDetail.js` に直接大きなAIロジックを書かない。
- `ArticleDetail.js` は記事データを `ArticleAiPanel` に渡すだけにする。
- `ArticleAiPanel` 内で `useArticleAi(article)` を使う。
- AI出力の本文描画は `AiMarkdownText` に寄せる。
- Reader Mode本文が取得できる場合は `articleContext.js` に渡す。
- 既存の `ArticleDetail.js` は通常記事表示と Reader Mode 表示を条件分岐している。初期実装では通常記事表示の `ScrollView` 内、記事本文/URL情報の下に `ArticleAiPanel` を置く。
- Reader Mode 表示中にも使う場合は、`ArticleReader` に直接AIロジックを入れず、`ArticleDetail.js` 側で `readerContent` を `ArticleAiPanel` に渡す構成にする。
- 既存の固定下部アクションバーと重ならないよう、通常記事表示では `contentContainer.paddingBottom` を維持し、AIパネルが下部バーに隠れないか実機で確認する。

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
- assistant メッセージの本文は `AiMarkdownText` 経由で `react-native-enriched-markdown` 表示にする。
- user メッセージは通常テキスト表示でよい。
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
- 翻訳
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

- 要約翻訳
- `translationService.js`
- `languageDetect.js`
- 翻訳設定 (有効/無効、翻訳先言語) の追加
- 要約モードの `日本語訳を見る` ボタン
- 翻訳キャッシュの整合性 (要約再生成時の無効化)

作業5:

- `react-native-gifted-chat` による単一記事チャット
- 質問チップ
- チャット履歴

作業6:

- TTSモデル管理
- 要約読み上げ
- チャット回答読み上げ

作業7:

- SQLiteを使った意味検索の検証
- 関連記事チャットの技術検証
- 本文翻訳 (Phase 9) の検証

mainで直接作業するため、各作業の区切りでは最低限以下を確認する。

- 既存の記事閲覧が壊れていない。
- モデル未準備状態でクラッシュしない。
- 追加した設定項目が保存/復元できる。
- 実機検証で見つかった制約をこの計画書に追記している。

## 保留中の検討事項

ここには「やる/やらない」を結論せず、後で再評価できるように情報だけ残す項目を書く。
判断が固まったらこの章から外して上の作業フェーズに移すか、却下記録として残す。

### Gemma 4 E2B 検証 (executorch 0.9.1, 2026-06-12 保留)

#### きっかけ

2026-06-11 に `react-native-executorch` が `v0.9.1` をリリース ([PR #1228](https://github.com/software-mansion/react-native-executorch/pull/1228))。
breaking change なしで以下を追加:

- **Gemma 4 E2B サポート** (text-only LLM + multimodal: audio-vision-text)
- **iOS 向け MLX backend 追加** (`libbackend_mlx_ios.a` / `mlx.metallib` 同梱)
- Vulkan/XNNPACK backend 経路も Gemma 4 用に拡張

feedown 1.0.12 は `react-native-executorch@^0.9.0` を pin 中なので、bump すれば
`GEMMA4_E2B` 定数を `apps/mobile/src/ai/models.js` に追加するだけで `FEEDOWN_LLM_MODELS`
の選択肢に並ぶ (既存 `LFM2_5_*` / `QWEN3_*` と同じ `{modelSource, tokenizerSource,
tokenizerConfigSource}` シェイプ)。

#### モデルファイルサイズ (`software-mansion/react-native-executorch-gemma-4` @ HF)

| backend | サイズ | プラットフォーム既定 |
|---|---|---|
| MLX int4 | **2.89 GB** | iOS 既定 (v0.9.1 で MLX backend が新規追加) |
| Vulkan 8da4w | **2.57 GB** | Android 既定 |
| XNNPACK 8da4w | **2.63 GB** | cross-platform fallback |

参考: 既存最大の `qwen3_5_2b_quantized` ≈ ~1.2 GB。Gemma 4 E2B は約 2 倍。

#### 保留にする理由

1. **4GB RAM 端末で動く保証がない**。`poc/llama-rn-gemma4` の Phase D 検証
   ([[project-llama-rn-poc]] 参照) で、iPhone 13 mini (A15, 4GB) では Gemma 4 E2B
   は GGUF Q4_K_M / Q3_K_M / UD-Q2_K_XL いずれも **jetsam OOM 確定**だった。
   理由は「~2.5GB + RN/Hermes/dev baseline がプロセス jetsam 上限を超える」=
   **backend 非依存の物理的な壁**。executorch の MLX int4 (2.89GB) / XNNPACK 8da4w
   (2.63GB) も同じ壁に当たる可能性が極めて高い。実機検証なしで「動くと思う」では
   App Store ユーザーに出せない。
2. **App Store バイナリ影響**。MLX backend が iOS バイナリに `mlx.metallib` +
   `libbackend_mlx_ios.a` を追加。サイズ増分は未測定だが、メリットが Gemma 4 のみで
   他モデルの恩恵が無いなら割に合わない。
3. **品質の比較対象が無い**。現行 `LFM2.5-1.2B Instruct` が要約のデフォルト。
   Gemma 4 E2B が「同等以上の品質を、より大きなメモリで」出すなら採用理由が薄い。
   ベンチを取らないと判断できないが、実機検証コスト > 現時点のメリット。

#### Google `gemma-4-qat-mobile` コレクション との関係

[google/gemma-4-qat-mobile](https://huggingface.co/collections/google/gemma-4-qat-mobile)
には E2B/E4B × `-transformers`/`-ct` の 4 モデルがある。

- `-transformers`: HF Transformers (safetensors) — サーバ/desktop PoC 用
- `-ct`: LiteRT-LM (`.task` / `.litertlm`) — **MediaPipe LLM Inference / AI Edge** 用

いずれも executorch の `.pte` ではないため、**react-native-executorch では直接使えない**。
[`software-mansion/react-native-executorch-gemma-4`](https://huggingface.co/software-mansion/react-native-executorch-gemma-4)
は Google の Gemma 4 E2B を ExecuTorch `.pte` 形式に変換したもの (`base_model: google/gemma-4-E2B`)。
モデル重みは同じ、ランタイム形式が違うだけ。

将来 **E4B (~4B effective) を使いたい** と思った場合の選択肢:

- software-mansion が `.pte` E4B を公開するのを待つ (現在は E2B のみ)
- 自前で executorch export script を回して E4B を `.pte` 化 (= 重い作業)
- 別ランタイム (MediaPipe LLM Inference, llama.rn など) に踏み込む = 統合改修

#### 再開する時の最小経路

「やる」と決めたら、`main` を汚さずに以下で検証:

1. `git checkout -b poc/gemma4-mlx-e2b`
2. `apps/mobile/package.json` の `react-native-executorch` と
   `react-native-executorch-expo-resource-fetcher` を `^0.9.1` へ bump
3. `apps/mobile/src/ai/models.js` に `GEMMA4_E2B` を import して
   `FEEDOWN_LLM_MODELS` に追記 (`recommendation: 'candidate'`, features `['summary']`,
   notes に「~2.9GB / 4GB 端末では動かない可能性あり」を明記)
4. `eas build --profile development --platform ios` で dev client ビルド
5. 実機で DL → 要約生成 → ピークメモリ / jetsam の有無 / tok/s を計測
6. 結果を [[project-llama-rn-poc]] の「executorch 比較」項目に追加

判断ルート: jetsam OOM が出るなら却下、出るが iPhone 15 Pro (6GB) 以降のみ動く
なら `canRunOnDevice` ゲート前提で再検討、すべての対象端末で動くなら main 採用判断へ。
