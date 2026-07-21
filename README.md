# myplanet

## 統治原則

Intent-First。詳細は [CLAUDE.md](CLAUDE.md) 参照

## 導入済みのskill

- `docs-use` — ドキュメント層規約（raw-rfp/rfp/requirements/internal-design/development/knowledge）
- `rea` — 開発サイクルの状態機械（`/rea` で起動）
- `vet` — 品質ゲートのオンデマンド適用（`/vet` で起動）
- `orchestrator` — 複数subagentによるレビューループ実行（プロトタイプ扱い。`default.md` workflowのみ同梱）

## ディレクトリ

```
CLAUDE.md              統治原則
.claude/skills/         上記skill本体
docs/
  raw-rfp/              要望原文
  rfp/                  整理された要望
  requirements/         要件定義
  internal-design/      内部設計（コードから読み取れない情報のみ）
  development/          開発ツール・ルール
  knowledge/            知識・reference
  CODEMAP/              実情ベースのマッピング（後から作成）
tmp/                    git非管理の一時ファイル（scratchpad等）
```

## 現在の状態

環境の初期構築のみ完了。プロダクトの中身（raw-rfp 等）は未着手。
