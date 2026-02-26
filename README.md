# LFT (Looking For Team)

APEX向けの募集・応募マッチングアプリです。  
認証は Supabase Auth + Discord OAuth を利用しています。

## 必要な環境変数

`.env.example` をコピーして `.env.local` を作成し、値を設定してください。

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_ADMIN_USER_IDS`（管理者ユーザーIDをカンマ区切り）

## 開発起動

```bash
npm install
npm run dev
```

## 本番公開前チェック

1. Supabase Auth の `Site URL` を公開URLに設定
2. Discord Developer Portal の `Redirects` に以下を登録
   - `https://<公開ドメイン>/auth/callback`
3. Supabase Auth Provider(Discord)の Client ID / Client Secret を最新化
4. デプロイ先（Vercel等）に環境変数を設定
5. 管理者ページを使う場合は `NEXT_PUBLIC_ADMIN_USER_IDS` を必ず設定

## ビルド / 本番起動

```bash
npm run build
npm run start
```
