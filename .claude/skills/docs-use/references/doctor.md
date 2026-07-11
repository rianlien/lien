# docs-use doctor — 規則違反ドキュメントの調査と除霊

docs-use が定める規則に違反する doc を調査し、優先度づけして報告する手順。`doctor` は正式な機械コマンドではなく、本手順に沿った監査である。検出だけを行い、修正 (`--fix`) は明示指定時のみ行う。

## ARGUMENTS

`doctor [探索する範囲や探索のときの方法、優先度づけ] [--fix]`

- **範囲**: ディレクトリ / glob / 「git status の変更分」など。省略時は repo 全体の docs。大きい場合は変更分か指定ディレクトリに絞る (絞った範囲は報告で明示する)。
- **方法**: 探索の進め方。Tier 2 は**可能なら既定で file-group ごとの並列 subagent**を使う（下記「監査は二層」参照）。「逐次で」「1 エージェントで」等の指定で上書きできる。
- **優先度**: 「internal-design の肥大化優先」「STALE だけ先に」など。
- **--fix**: 検出後 remediation_rules に従って修正する。既定は報告のみ。破壊的なのでレビュー前提。

引数は自然言語で良い。範囲・方法・優先度を読み取り、無指定の軸は既定 (下記) を使う。

## 起動条件とトリガー例

doctor を**起動すべき**要求 (✅):

- 「docs-use doctor で docs を調べて」「/dg402-dev:docs-use doctor docs」
- 「internal-design が肥大化していないか調べて」「規則違反／ルールから逸脱した docs を探して」
- 「ドキュメントを除霊して」「stale な docs を直して」(後者は `--fix`)

doctor を**起動しない**要求 (❌ — 通常の docs-use として処理):

- 「この要件を requirements に追記して」(特定 doc の write)
- 「リポジトリ構造を把握したい」(通常の docs-use)
- docs と無関係のタスク (例: アプリのバグ修正のみ)

判定: 「**既存 docs の規則違反を網羅的に検出/修正する**」意図なら doctor、「特定の doc を読み書きする」なら通常の docs-use。

## 監査は二層

### Tier 1: 構造 lint (決定的・高確度)

`scripts/docs-lint.sh [範囲]` を実行する。以下を機械検出する:

- **topic 記法**: `<raw_rfp|rfp|requirements|internal_design>` の opening tag に `status=` と `name=` が必須。
- **supersession**: `status="superseded"` には `superseded-by=` 必須。
- **human**: `<human>` に `ts=` 必須。
- **legacy**: `<unrealized>` 記法の残存 (topic 記法へ移行が必要)。
- **link**: 相対リンクが解決すること。git 管理ファイルが git 非管理パス (`tmp/` 等) を参照しないこと。
- **traceability**: `rfps=` / `raw-rfps=` / `requirements=` / `superseded-by=` が参照する `name` が実在すること (dangling 検出)。
- **hygiene**: docs ツリー内の `.DS_Store` 等。

script が拾えない構造規則 (人手確認):

- **配置**: 各 `.md` が `raw-rfp / rfp / requirements / internal-design / development / knowledge` のいずれかにあるか。`CODEMAP` は別系。
- **docs_confliction_prevention**: サブディレクトリ内に閉じる情報が repo root の docs に置かれていないか (repo root 側ほど変化が少なくなる配置か)。
- **raw_rfp の human 必須**: raw_rfp topic 内に `<human>` 原文があるか。

### Tier 2: 意味的監査 (判断。doc guide の中身違反。特に internal-design)

各 doc の各 topic / ブロックを次に分類する。**コードを実際に開いて導出可能性を裏取りしてから flag する** (deception 防止)。

- **MECHANISM-DUP** (違反): internal-design に、コードから読み取れる機構 (リソース/値の表・dir tree・ポート/CIDR/ARN・保持日数・閾値) が転記されている。`internal_design_docs_guide` の「実装コードやそのコメントで表現できる部分や、コードから読み取るのが著しく困難でない情報は、ドキュメント化してはならない」違反。
- **STALE** (違反): doc が、もう存在しない / 変わったコード・構成を記述している。リファクタ後に頻発する。コードと突合して確認。
- **MIS-LAYERED** (違反): レイヤ取り違え。raw-rfp 級 (要望原文・human 発話) や requirements 級 (外部から見た振る舞い・契約・SLO・対応範囲) が internal-design に混入している。本来のレイヤへ分解すべき。
- **MISSING-INTENT** (弱点): 「何を」だけ書いてあり、非導出の「なぜ」が無い。
- **KEEP** (違反でない・flag しない): 却下した代替・トレードオフ・外部/契約由来の制約・順序の理由など、コードから復元できない intent。

判定の指針:

- 「コードを読めば同じ情報が得られるか?」が MECHANISM-DUP の試金石。得られるなら機構、得られないなら intent。
- 迷ったら必ずコード (`.tf` / source) を開いて確認する。推測で flag しない。
- **可能なら既定で file-group ごとに並列 subagent を立てて監査する**（独立視点で網羅性と deception 耐性を上げるため）。各 subagent に懐疑的 rubric (「bloat を疑え、ただしコード突合で裏取りしてから flag せよ。genuine intent は flag するな」) とコード突合の必須を課す。スコープが 1〜数ファイルと小さい場合・`--fix` の pilot・subagent が使えない環境でのみ単一パスにする。

## 出力 (報告)

優先度順に報告する:

1. **STALE** — 検証済みの事実誤認。最優先 (誤情報は害)。
2. **MIS-LAYERED** — レイヤ規則違反。
3. **MECHANISM-DUP** — 肥大化 (判断を伴う)。high/med と low/borderline を区別する。
4. **MISSING-INTENT**。

各項目: `file:line` / type / evidence (該当箇所) / code_ref (導出元の `path:line`、または N/A) / why (一行)。あわせて **健全な手本** (intent only の doc) を挙げ、削除してはいけない intent を明示する。

## remediation_rules (`--fix` 時 / 修正方針)

- **STALE** → コードに合わせて修正する。値が機構なら「コード正本へのポインタ」に置換する (再転記しない — また腐る)。
- **MECHANISM-DUP** → 「**生成規則の一文 + `modules/.../X.tf` が正本**」に圧縮する。表を単に消さない (intent を残す)。**コードコメントへ全移植しない** (それは別の規則違反)。
- **MIS-LAYERED** → 分解する。原文 → `raw-rfp/`、要件 → `requirements/` (チェーン維持のため必要なら `rfp/` も)、internal-design には非導出の設計判断 + ポインタのみ残す。`rfps=` / `raw-rfps=` でトレーサビリティを保つ。
- **superseded-by の歴史ブロックは触らない** (トレーサビリティのため保全する。現行名を後付けすると新旧が混在し不整合になる)。
- 値の二重管理を避け、コード正本ポインタを優先する。
- 制約 (intent) を変えたら該当ドキュメントに Intent を記録する (CLAUDE.md の Intent-First)。
- **low/borderline は残す**。落とした範囲を必ず log する (silent な truncation をしない)。

## 優先度・進め方の既定

- 重大度: STALE > MIS-LAYERED > MECHANISM-DUP。high/med から着手し、low/borderline は残す。
- 破壊的な修正は**パイロット 1 ファイル → diff レビュー → 横展開**の順で行う。
- `--fix` はレビュー前提。superseded は不可侵。
- Intent-First: Mechanism (コード/実装の都合) が Contract/Intent (要件・要望) を黙って書き換えないよう、レイヤ移送は人間に確認する。

## 既知の落とし穴 (この監査自体の deception 防止)

- **規則の中身（各レイヤに何を残す/残さないか）の正本は SKILL.md の guides（docs_structure / 各 doc guide / topic_notation 等）。doctor.md は規則を再記述・複製せず、検出・修正の手順のみを持つ**（規則を例示・複製すると二重管理で腐り、それ自体が MECHANISM-DUP になる）。
- audit の severity ラベルを鵜呑みにせず、規則 (doc guide) を基準に判断する。
- 「現在の状態」節は機構の写しになりやすい。コード正本ポインタへ畳む。
- パリティチェックリスト等、機構の列挙でも非導出の用途があるものは KEEP (用途を一行で明示)。
