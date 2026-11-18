# bbs-api

スレッドフロート型掲示板の REST API。

**Bun / TypeScript / Express 5 / Prisma 7 / PostgreSQL / argon2**

## セットアップ

```bash
bun install
cp .env.example .env          # DATABASE_URL などを編集
docker compose up -d          # PostgreSQL 18 (任意。自前の DB でも可)
bun run db:generate           # Prisma Client 生成 (generated/prisma)
bun run db:migrate -- --name init   # 初回マイグレーション
bun run db:seed               # 板 "general" を作成。SEED_ADMIN_PASSWORD を .env に入れると管理者も作成
bun run dev
```

http://localhost:3000/health が `{"status":"ok"}` を返せば OK。

> スキーマ (`prisma/schema.prisma`) を変えたら `bun run db:migrate` → `bun run db:generate`。

## WebStorm での使い方

- `bun` が PATH にあれば、フォルダを開くだけで OK。
- `package.json` の左の ▶ から `dev` を実行できます。
- Settings → Languages & Frameworks → Node.js で Bun をランタイムに設定すると、デバッグも Bun で動きます。
- Prisma 用に Prisma プラグイン (Prisma ORM) を入れると schema の補完・フォーマットが効きます。
- `generated/` は Git 管理外です。clone 後は `bun run db:generate` を実行してください。

## 認証

`POST /api/auth/register` か `login` で返る `token` を、以降 `Authorization: Bearer <token>` で送ります。
トークンは DB にハッシュ (SHA-256) だけ保存、パスワードは argon2id、有効期限は `SESSION_TTL_DAYS`。

## エンドポイント

| Method | Path | 認証 | 説明 |
|---|---|---|---|
| POST | `/api/auth/register` | - | ユーザー登録 (そのままログイン) |
| POST | `/api/auth/login` | - | ログイン (`username` はユーザー名かメール) |
| POST | `/api/auth/logout` | 要 | ログアウト |
| GET | `/api/auth/me` | 要 | 自分の情報 |
| GET | `/api/boards` | - | 板一覧 |
| POST | `/api/boards` | ADMIN | 板作成 `{slug, name, description}` |
| GET | `/api/boards/:slug/threads?page&limit` | - | スレ一覧 (固定 → 最終書き込み順) |
| POST | `/api/boards/:slug/threads` | 要 | スレ作成 `{title, body}` |
| GET | `/api/threads/:id` | - | スレ情報 |
| PATCH | `/api/threads/:id` | MOD/ADMIN | `{pinned?, locked?}` |
| GET | `/api/threads/:id/posts?from&limit` | - | レス一覧 (`from` はレス番号) |
| POST | `/api/threads/:id/posts` | 要 | レス投稿 `{body, sage?}` |
| DELETE | `/api/posts/:id` | 本人/MOD | レスの論理削除 |

### スレッドフロートの仕様

- `sage: false` (デフォルト) のレスでスレの `bumpedAt` が更新され、一覧の上に上がる
- `sage: true` なら上がらない
- 固定 (`pinned`) スレは常に先頭
- 1 スレ 1000 レスで投稿不可 (`MAX_POSTS_PER_THREAD`)。ロックされたスレにも投稿不可
- レス番号はトランザクション内の行ロックで採番するので、同時投稿でも重複しない

### curl 例

```bash
curl -s localhost:3000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"alice","email":"a@example.com","password":"password123"}'

curl -s localhost:3000/api/boards/general/threads -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" -d '{"title":"はじめまして","body":"よろしく"}'
```

## ディレクトリ構成

```
prisma/schema.prisma     スキーマ
prisma.config.ts         Prisma 7 の接続設定
scripts/seed.ts          初期データ
src/index.ts             起動・終了処理
src/app.ts               Express 組み立て (helmet / cors / rate limit)
src/config.ts            環境変数 (zod で検証)
src/db.ts                PrismaClient (adapter-pg)
src/lib/                 password / session / errors / params
src/middleware/          auth / error
src/routes/              auth / boards / threads / posts
```

## 今後の拡張アイデア

アンカー (`>>2`) 解析、レスの通報、板ごとの設定、スレ dat 落ち (古いスレのアーカイブ)、テスト (`bun test`)。
# WebBackend_kadai
