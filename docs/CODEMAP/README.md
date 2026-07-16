# CODEMAP

リポジトリ構成のマッピング。詳細な規約は `docs-use` skill を参照。

## docs（色グラデーションアプリ関連、トレーサビリティ順）

- `docs/raw-rfp/color-gradient-app.md` — 要望原文
- `docs/rfp/color-gradient-app.md` — 要望整理
- `docs/requirements/color-gradient-app.md` — 要件定義（③ 視覚表現コアの範囲）
- `docs/requirements/color-gradient-app-async-flow.md` — 要件定義（①② 招待・非同期回答フローの範囲）
- `docs/requirements/color-gradient-app-session-completion.md` — 要件定義（発起人による「完成」確定、未実装）
- `docs/internal-design/color-gradient-app.md` — 内部設計（視覚表現の実装方式: Oklab・ドメインワープ・ドリップ）
- `docs/internal-design/color-gradient-app-async-flow.md` — 内部設計（招待・非同期回答フローの実装方式: 永続化・API・ポーリング）

## app（実装）

- `app/mesh-gradient/public/index.html` — 発起人ページ。自分の位置・色を決め、友達を配置して招待リンクを発行する。
  友達の回答をポーリングで自動反映する。
- `app/mesh-gradient/public/reply.html` — 回答者ページ。招待リンクを開いた友達が色を選ぶ。自分の入力と結果の
  ポストカードのみが見え、発起人の配置や他の友達の情報は見えない。
- `app/mesh-gradient/public/mesh-render.js` — Mesh Gradient描画エンジン（Oklab知覚補正ブレンド、ドメインワープ、
  ドリップ、紙質感）。発起人・回答者の両ページから共有。
- `app/mesh-gradient/public/style.css` — 両ページ共通のスタイル。
- `app/mesh-gradient/lib/participants.js` — セッション/参加者の業務ロジック（永続化方式から独立、ローカル/Vercel共有）。
- `app/mesh-gradient/lib/file-store.js` — ローカル開発用永続化（JSONファイル、セッションごとに1ファイル）。
- `app/mesh-gradient/lib/kv-store.js` — Vercelデプロイ用永続化（Upstash Redis）。
- `app/mesh-gradient/server.js` — ローカル開発用サーバー（静的ファイル配信＋API、`.claude/launch.json`から起動）。
- `app/mesh-gradient/api/**` — Vercelデプロイ用serverless functions（同じAPIをVercel上で実行）。
- `app/mesh-gradient/vercel.json` — Vercelのビルド設定（静的ファイルの出力先を`public/`に指定）。
- `app/mesh-gradient/package.json` — 依存関係（`@upstash/redis`）。
- `app/mesh-gradient/data/` — ローカル開発の実行時データ（JSONファイル永続化）。git管理外（`app/mesh-gradient/.gitignore`）。

## .claude

- `.claude/launch.json` — dev server起動設定（`mesh-gradient-spike`が`app/mesh-gradient/server.js`を起動）。
- `.claude/skills/` — rea / docs-use / vet / orchestrator 等のプロジェクト運用skill。
