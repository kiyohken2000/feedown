

---

# FeedOwn 開発メモ

## 使用サービス
- **Supabase** - データベース・認証 (https://supabase.com)
- **Cloudflare Pages** - Web版のホスティング・API (https://dash.cloudflare.com)
- **GitHub** - ソースコード管理 (https://github.com/dandelion39tanpopo/feedown)

## Web版
- **修正方法**: GitHubのコードを編集してpush → Cloudflareが自動でビルド・デプロイ
- **確認場所**: Cloudflare Pages → feedown-43s → Deployments

## モバイルアプリ (Android/iOS)
- **修正場所**: `D:\Documents\app\feedown\apps\mobile\`
- **起動方法**: `expo start`
- **注意**: ローカルで修正・確認。Webとは別管理。

## 構成
```
feedown/
├── apps/web/        ← Web版 (Cloudflareに自動デプロイ)
├── apps/mobile/     ← モバイルアプリ (ローカルPC管理)
└── functions/api/   ← APIサーバー (Cloudflare Pages Functions)
```

---

これをそのまま `README.md` としてリポジトリのルートに置けばOKです。追記したい内容があれば言ってください。