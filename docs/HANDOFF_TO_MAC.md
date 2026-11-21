# Mac セッションへの引継ぎ（2026-11-21）

Windows セッションから Mac に移り、モバイルアプリをローカルビルドするための引継ぎ。回答は日本語・簡潔に。

## 目的

1.0.14（iOS build 20 / Android versionCode 15）をローカルでビルドして動作確認し、提出につなげる。

## 現状（main = `24c0828` 時点）

- **バージョン**: `apps/mobile/app.json` → version `1.0.14`, iOS `buildNumber` `20`, Android `versionCode` `15`
- **主要依存**: Expo SDK 58 (`expo ^58.0.20`) / RN 0.88.0 / `react-native-executorch 0.11.1` / `llama.rn 0.13.0-rc.8`
- `apps/mobile/ios`・`android` は git 管理外（CNG）。ローカルビルドは `npx expo prebuild` から

### 最近のコミット（1.0.14 に関係するもの）

| commit | 内容 |
|---|---|
| `b7b22d8` | executorch 0.11.0 → **0.11.1**（iOS プライバシーマニフェスト復活 #1627、undefined の sampling オプションがデフォルトに戻る #1611、ネイティブ libs が `v0.11.1-libs` に）。**まだどのビルドにも入っていない → 要実機確認** |
| `d3d7641` | `FOREGROUND_SERVICE_DATA_SYNC` を `app.json` の `blockedPermissions` でブロック（Play Console の宣言要求回避） |
| `4dfef92` | Android release の R8 が downloader の optional MMKV クラスで落ちる件 → `-dontwarn` で修正 |
| `30f533c` | Lottie 画面のサイズを `useWindowDimensions` に |
| `bc49cb3` | 1.0.14 へバージョン上げ |

Web（`24c0828` ロゴ → `/`、`e32b4c5` 公開ページのスマホ対応）はデプロイ済みで Mac 側の作業は不要。

## Mac でやること

1. `git pull` → ルートで `yarn install`
2. `cd apps/mobile && npx expo prebuild --clean`
3. iOS: `npx expo run:ios --device`（iPhone 13 mini 実機）/ Release 確認は `--configuration Release`
4. Android: `npx expo run:android --variant release`（R8 修正と FGS 権限ブロックの確認）
5. 確認ポイント
   - executorch 0.11.1: 要約・翻訳（LFM2.5 / Qwen3）が動くか、初回のモデル再 DL
   - iOS: ビルド成果物に executorch の `PrivacyInfo.xcprivacy` が入っているか
   - Android release: 起動・モデル DL（MMKV 経路）でクラッシュしないか、マージ後の Manifest に `FOREGROUND_SERVICE_DATA_SYNC` が無いか
   - BRUSHUP #26 手順 4 の残り: 翻訳 LFM フォールバック / 信号分離 / ベンチマーク、iPhone Duo シミュレーター（iOS 27.1 SDK）
6. 通ったら production build → 1.0.14 提出。**EAS ビルド・提出はユーザー確認を取ってから**
   - Android は古い AAB を Play のリリースから外して作り直したものを上げる

### リリースノートに入れる内容

- AI モデルは初回起動時に再ダウンロードが必要（旧モデルは削除される）
- 長い記事の要約を改善（コンテキスト 2k → 16k）
- iOS 27 / iPhone Duo 対応

## 見送り・保留

- **llama.rn**: npm `latest` は `0.13.0-rc.12`（11/17）。rc.10〜12 で例外処理の改善（#426, #430）、`decide()` 修正、llama.cpp 同期 3 回。アプリは embedding / `n_keep` / `decide()` を未使用なので **1.0.14 では rc.8 のまま**。SemIf を `decide()` で作り直す時にまとめて上げる
- バックログ: gifted-chat 3.x、SemIf クラッシュ調査（#25）、TTS の executorch 新 API 移植、未使用の vector-icons / BlurBox 削除

## 注意事項

- `main` に直接コミットしてよい。コミット末尾に Co-Authored-By / Claude-Session 行
- 外向きの操作（EAS ビルド、ストア提出）は事前に確認
- Win でドラフトしたネイティブ系の変更は未検証扱い（今回該当なし）
- 詳細な経緯: `docs/BRUSHUP_PLAN.md` の #26
