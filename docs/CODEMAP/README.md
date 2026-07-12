# CODEMAP

リポジトリ構成のマッピング。詳細な規約は `docs-use` skill を参照。

## docs（色グラデーションアプリ関連、トレーサビリティ順）

- `docs/raw-rfp/color-gradient-app.md` — 要望原文
- `docs/rfp/color-gradient-app.md` — 要望整理
- `docs/requirements/color-gradient-app.md` — 要件定義（現状: 視覚表現コア試作の範囲のみ）
- `docs/internal-design/color-gradient-app.md` — 内部設計（現状: 上記の実装方式）

## app（実装）

- `app/mesh-gradient/index.html` — Mesh Gradient視覚表現の試作（単一HTML、外部依存なし）。
  1人が自分+友達の位置・色を1画面内で仮に置いて、完成アートの見た目だけを確認できるローカルシミュレーター。
  友達へのURL送付・非同期の複数人フローは未実装。
- `app/mesh-gradient/server.js` — 上記をローカル配信する最小static server（`.claude/launch.json`から起動）。

## .claude

- `.claude/launch.json` — dev server起動設定（`mesh-gradient-spike`が`app/mesh-gradient/server.js`を起動）。
- `.claude/skills/` — rea / docs-use / vet / orchestrator 等のプロジェクト運用skill。
