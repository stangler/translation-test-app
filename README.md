# 英語練習テスト — EIGO NO PARTNER

英単語・英文の和訳、および日本語から英訳の練習ができる Web アプリです。  
Next.js 14 + TypeScript で構築されており、データは Excel ファイルから自動生成されます。

---

## 機能

- **2 つのクイズモード**
  - 🇬🇧→🇯🇵 英→日 : 英語の文を見て日本語で答える
  - 🇯🇵→🇬🇧 日→英 : 日本語の文を見て英語で答える
- **レッスン・パート選択** : 学習したい範囲を絞り込める
- **シャッフル機能** : 問題をランダムな順番に出題
- **AI 採点** : 英→日モードでは Gemini または OpenRouter の AI が正解に近い日本語かを柔軟に判定
- **再挑戦** : 間違えた問題だけ、または全体を再度解ける
- **マジックリンク認証** : Resend を使ったメール認証 (next-auth 5 beta)
- **結果表示** : 得点率・正解数・間違えた問題の振り返り

---

## 使用技術

| カテゴリ       | 技術                                               |
| -------------- | -------------------------------------------------- |
| フレームワーク | Next.js 14 (App Router)                            |
| 言語           | TypeScript                                         |
| UI             | React 18 + Tailwind CSS                            |
| データベース   | PostgreSQL + Prisma ORM                            |
| 認証           | next-auth v5 (Resend プロバイダ)                   |
| メール送信     | Resend / react-email                               |
| AI 採点 API    | Google Gemini API または OpenRouter API (自由選択) |
| データ変換     | Python 3 (openpyxl) — xlsx から JSON に変換        |

---

## セットアップ

### 必要条件

- Node.js 20+
- pnpm (このプロジェクトは pnpm 専用)
- Python 3.11+ (データ変換用)
- PostgreSQL (データベース)

### インストール

```bash
pnpm install
```

### 環境変数

`.env` ファイルを作成し、以下の変数を設定してください。

```env
# データベース
DATABASE_URL="postgresql://..."

# 認証 (next-auth + Resend)
AUTH_SECRET="..."
AUTH_RESEND_KEY="..."
AUTH_EMAIL_FROM="noreply@example.com"

# AI 採点 — どちらか一方、または両方を設定
# Gemini を使う場合
GEMINI_API_KEY="..."
GEMINI_MODEL="gemini-2.0-flash"

# OpenRouter を使う場合
OPENROUTER_API_KEY="..."
OPENROUTER_MODEL="openrouter/free"
```

### データベースセットアップ

```bash
pnpm prisma migrate dev
```

### 単語データの生成

`xlsx/` ディレクトリに Excel ファイルを配置し、Python スクリプトで `public/words-data.json` を生成します。

```bash
pip install -r requirements.txt   # openpyxl をインストール
python build.py xlsx/EIGO_NO_PARTNERに出てくる文.xlsx
```

### 開発サーバー起動

```bash
pnpm dev
```

[http://localhost:3000](http://localhost:3000) で開きます。

---

## データパイプライン

| ファイル                 | 役割                                                            |
| ------------------------ | --------------------------------------------------------------- |
| `xlsx/...xlsx`           | 出典データ (Lesson / Part / 英語 / 日本語 の列構成)             |
| `build.py`               | xlsx を読み込み、別解展開・人称代名詞展開などを行い JSON に変換 |
| `public/words-data.json` | フロントエンドが読み込む単語データ                              |

`build.py` は以下の自動処理を行います。

- 括弧書き `（=別解）` からの別解抽出
- 可能形動詞の活用形自動生成（例: 書く → 書け）
- 一人称代名詞の自動展開（私は ↔ ぼくは / 僕は）
- 「〜をすることができる」→「〜ができる」等のパターン変換
- 「見ます」↔「みます」の表記揺れ対応

---

## デプロイ

[Vercel](https://vercel.com) へのデプロイを前提としています。

```bash
pnpm build
```

デプロイ時には環境変数 (特に `AUTH_SECRET`, `DATABASE_URL`, `AUTH_RESEND_KEY`, `GEMINI_API_KEY` または `OPENROUTER_API_KEY`) を Vercel の Environment Variables に設定してください。

---

## ライセンス

MIT
