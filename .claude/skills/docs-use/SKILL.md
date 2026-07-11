---
name: docs-use
description: リポジトリの構造を把握したいとき、ドキュメントを read/write するとき、各種の開発作業を行うときに使用する。また「docs-use doctor」「ドキュメントの除霊」「規則違反／ルールから逸脱した docs を調査」などと求められたとき、docs-use 規則に違反する doc の調査・修正にも使用する。
---

## 基本的な原則

ドキュメントファーストです。

開発してからドキュメントを作るのではなく、ドキュメントを書いてから、それを実現します。

CODEMAP など、実情をもとに構成するドキュメントは例外的に後から書きます。
また、詳細な設計情報を常にドキュメント化する必要はなく、 internal-design にあるようにコードだけを変更すればいいケースもあります。

## CODEMAP

リポジトリの構成について把握する際には必ず `**/docs/CODEMAP/*.md` を参考する。

<codemap_guide>
CODEMAP は、情報とファイルをマッピングすることで、欲しい情報を得るために読み込むべき必要充分なファイルを知るためにあります。
- コードだけでなくドキュメントもマッピングの対象です。
- 各ファイルの行数や、テストの数などの統計情報や、マッピングの目的に合わない情報は一切不要です。保守コストを増大させるだけなので含めてはいけません。

CODEMAP は `<repo_root/>/docs/CODEMAP` を中心として、サブディレクトリに再帰的に配置（ `<subdir/>/docs/CODEMAP` ）することもできる。
- docs_confliction_prevention に注意してください。
</codemap_guide>

<codemap_update_skill>
CODEMAP は `ecc:update-codemaps` skill でディレクトリを指定して更新します。その際、 docs-use skill と codemap_guide に必ず従う必要があります。
</codemap_update_skill>

## docs

開発を進める際に必要な情報を docs ディレクトリに配置します。

<docs_location>
docs はリポジトリルート（`<repo_root/>/docs/**`）を中心として、サブディレクトリに再帰的に配置（`<subdir/>/docs/**`）することもできます。
<docs_confliction_prevention>
ドキュメントの衝突を避けるため、分割統治的にサブディレクトリ内に閉じた情報はできるだけサブディレクトリの docs に配置する。 repo root からサブディレクトリのより再帰の末端ノードにかけて、 repo root 側はより変化が少なくなるようにする。
※ 既存の docs は以上の方針に反するケースがあるので、適宜修正する必要がある。
</docs_confliction_prevention>
</docs_location>

<docs_structure>
- docs
  - raw-rfp/`**/*.md` : 要望原文, see raw_rfp_docs_guide
  - rfp/`**/*.md` : 要望（整理されたもの, Request for Proposal）, see rfp_docs_guide
  - requirements/`**/*.md` : 要件定義, see requirements_docs_guide
  - internal-design/`**/*.md` : 内部設計, see internal_design_docs_guide
    - 外部的な振舞いを内部的にどう実現するかの設計
    - 実装コードやそのコメントで表現できる部分や、コードから読み取るのが著しく困難でない情報は、ドキュメント化してはならない
    - intent: コードから読み取れない情報を補完する
  - development/`**/*.md` : 開発情報, see development_docs_guide
    - 開発ツールや、その使い方などのルール、制約、注意
    - 適宜内容を吸い上げて、 skill 化できるものは skill 化する
  - knowledge/`**/*.md` : 知識
    - 知識全般、 reference を兼ねる
    - 適宜内容を吸い上げて、 skill 化できるものは skill 化する
</docs_structure>

<topic_notation>
raw-rfp, rfp, requirements, internal-design は、専用タグで囲ってマーカーとします。

- 例: `<rfp status="realized|unrealized|superseded" name="topic_unique_name" raw-rfps="name0,name1"></rfp>`
  - status, name 必須です。
- raw-rfp: タグ=raw_rfp, 内部に human タグ必須です。 see human_inputs_treatment.
- rfp: タグ=rfp, 関連する raw-rfps をつけます。
- requirements: タグ=requirements, 関連する rfps をつけます。
- internal-design: タグ=internal_design, 関連する requirements をつけます。
- その他、ドキュメント内に名前をつけたいトピックがある場合には `<some_unique_name></some_unique_name>` のようなタグで囲って、参照用のマーカーとします。
- 内部で、必要に応じて human タグを使ってください。 see human_inputs_treatment.
- 新しい仕様で supersede されたときには status=superseded とし superseded-by 属性をつけてください。 see topic_supersession.
- 古いスタイルの topic アイテムがドキュメント上には残っているので注意してください。 see legacy_unrealized_notation.
</topic_notation>

<raw_rfp_docs_guide>
要望原文
- human からの要望を原文のまま（ないし、直訳）したもの
- intent: 要望解釈のずれを防ぐため、原文（ないし、直訳）をそのまま保存する。
- see topic_notation, human_inputs_treatment
</raw_rfp_docs_guide>

<rfp_docs_guide>
要望（整理されたもの, Request for Proposal）
- 整理された要望（raw-rfp を整理したもの）
- 要望であって、それをどう実現するかは含みません。
- 陽に指定されていない要望については、陽に項目を出した上で未指定であることを明示する
- raw-rfp との対応づけを必ず行う
- intent: 与えられた要望原文を分析し、整合性を持たせる、要望者との擦り合わせを行う
- see topic_notation, human_inputs_treatment
</rfp_docs_guide>

<requirements_docs_guide>
要件定義
- 要望をどのように充たすかを定義する
- 要望者にとって必要な、外部からみた振舞いや、インタフェース、制約、SLO 等を含み、内部設計は含まない
- 定義がない項目については、陽に項目を出した上で、それについては内部設計に任されることを明示する
- rfp との対応づけを必ず行う
- intent: 要望の充足可能性を検証する、要望者との擦り合わせを行う
- see topic_notation, human_inputs_treatment
</requirements_docs_guide>

<internal_design_docs_guide>
内部設計
- 外部的な振舞いを内部的にどう実現するかの設計
- 実装コードやそのコメントで表現できる部分や、コードから読み取るのが著しく困難でない情報は、ドキュメント化してはならない
- intent: コードから読み取れない情報を補完する
- see topic_notation, human_inputs_treatment
</internal_design_docs_guide>

<development_docs_guide>
開発情報
- 開発ツールや、その使い方などのルール、制約、注意
- 適宜内容を吸い上げて、 skill 化できるものは skill 化する
- see topic_notation, human_inputs_treatment
</development_docs_guide>

<knowledge_docs_guide>
知識
- 知識全般、 reference を兼ねる
- 適宜内容を吸い上げて、 skill 化できるものは skill 化する
- see topic_notation, human_inputs_treatment
</knowledge_docs_guide>

<topic_supersession>
トピックが衝突するより新しいトピックによって置き換えられるときにもトレーサビリティを保つ必要があります。

- status=superseded にする
- sperseded-by="superseder_unique_name0,superseder_unique_name1" をつける
- 一部だけが supersede される場合には、必ず topic を分割し、全体を無理矢理 superseded にしない。
</topic_supersession>

<legacy_unrealized_notation>
未実現ものには `<unrealized></unrealized>` タグで囲っていました。
古い notation です。 dev_topic に都度移行してください。

legacy なものから migrate する場合は以下のようにしてください。
- migrated-from-legacy="true" をつける
- timestamp が必要な topic の場合は ts="unknown" か、legacy なタイムスタンプ（`<!-- 2026-04-15 -->` 形式）から分かる場合には時刻以下の精度は 0 fill で、値を入れる
</legacy_unrealized_notation>

## human inputs

<human_inputs_treatment>
human からの input をドキュメント化する場合、原文等（原文ないし、その直訳）を残す。
- intent: 原文等を残さないと解釈のずれが蓄積し、ゴールがドリフトしていってしまうため

<human_inputs_literal_translation>
human からの inputs には、独特の言い回しや文脈依存の表現、NSFW な表現等が含まれるケースがある。
そういった原文を残すことは NG です。その場合、語を入れ替える程度の意味のドリフトを起こさない直訳を行ってください。
</human_inputs_literal_translation>

<human_inputs_notation>
human からの inputs の原文等を掲載する際は、必ず `<human ts="timestamp in 2026-05-07T16:35:26+09:00 style"></human>` タグで囲ってマーカーとします。
- ts 属性は必須です。衝突がある場合には、より新しい内容を優先します。（`date -Iseconds` 等を使ってください。）
- 原文等だけでは文脈把握が難しくなるため、必要に応じて前後に context を補ってください。
- 必ず human_inputs_literal_translation に従ってください。
</human_inputs_notation>
</human_inputs_treatment>

## scratchpad

<scratchpad_temporal_docs_location>
検討・調査・計画などで発生する、 Git 管理すべきでない一時的なドキュメントは scratchpad に作成します。

特に指定がない限り、ドキュメントは一時的と考えて scratchpad に作成してください。

- <repo_root/>/tmp/scratchpad/<subpath_required/>/`**/*.md`
</scratchpad_temporal_docs_location>

## doctor サブコマンド (規則違反の調査・除霊)

`/dg402-dev:docs-use doctor [探索する範囲や探索のときの方法、優先度づけ] [--fix]` で起動したとき（ARGUMENTS が `doctor` で始まるとき）は、本ファイルで定義する docs-use 規則（ディレクトリ構成・各レイヤの doc guide・topic_notation・トレーサビリティ・human inputs・git 非管理リンク、および機構転記/腐敗/レイヤ誤り）に違反する doc を調査する。

- まず `scripts/docs-lint.sh [範囲]` で Tier 1 の構造違反を機械検出する。
- 続いて意味的監査（Tier 2: MECHANISM-DUP / STALE / MIS-LAYERED）をコードと突合して行う。
- 手順・判定基準・出力形式・修正方針（`--fix`）は `references/doctor.md` を必ず読んで従う。

`doctor` 以外の通常利用では本セクションは無視してよい。
