# Default Workflow

このファイルは Orchestrator の**デフォルト workflow** を定義する。`--workflow` オプションが省略された場合に使用される。

**Intent（なぜこの workflow か）**: AI が自分自身の成果物を自己チェックしても死角は埋まらない。独立した subagent による作業 → レビュー → 修正のループを、不整合ゼロになるまで繰り返すことで品質を構造的に保証する。さらに、human の期待値との整合性を外側のゲートとして設けることで、ループ収束後も human の真の要求を充たしているかを確認する。

**Intent（ループ回数について）**: 内側レビューループも外側期待値ゲートも、意図的に回数上限を設けない。品質の収束を実行時間より優先するという設計上の判断であり、制限のないループは設計の欠落ではなく設計の意図である。

## 概要

内側ループ（作業 → レビュー → 修正を指摘ゼロまで繰り返す）と、外側ゲート（human の期待値を確認し未充足なら内側ループへ戻る）の2重構造で品質を保証する。

<review_termination_condition>
レビューループを終了して「期待値確認」に進む条件。以下の**すべて**を満たした場合のみ終了する：

- **完了状態の確認**: `<completion_status>` が `完了` であること。`部分完了` または `未完了` の場合は終了しない
- **指摘の不在**: `<findings>` に指摘が一切存在しない（「なし」または空）こと。スコープ内外を問わない

**Intent**: `[スコープ外]` のような silent-drop タグを許すと、reviewer の偶発的な気づきがループ内で誰にも拾われず情報が消える。スコープクリープよりも、セッション間で記憶を失ったことで自分が発生させた問題をスコープ外として放置することの方が現実的かつ致命的なリスクである。
</review_termination_condition>

<expectation_termination_condition>
期待値確認の終了条件: 未充足の期待値が存在しなければ workflow を完了する。
</expectation_termination_condition>

<orchestrator_read_obligation>
各 worker の response から `<orchestrator_instruction_reinterpretation>` タグを確認し、指示の誤りが報告された場合は workflow の前提を修正して継続する。
</orchestrator_read_obligation>

<worker_isolation_rule>
作業 worker・レビュー worker・修正 worker は、同一ループ内でもそれぞれ**別の worker 呼び出し**として実行する。同じ subagent を再利用してはいけない。
</worker_isolation_rule>

<immediate_task>
<step name="do_work">
worker を呼び出す。task は human_instructions と作業の概要を伝達する。（不明確なことを憶測で具体化しない。）orchestrator_read_obligation に従い `<orchestrator_instruction_reinterpretation>` タグを確認する。完了後、step `review_fix` に進む。
</step>
<step name="review_fix">
worker を呼び出す。task はここまでの作業の内容を審査し問題点・改善点を列挙し、修正すること（問題がなければ「指摘なし」と明示すること）。気づいた問題はスコープ内外を問わずすべて修正し、報告すること。`<orchestrator_instruction_reinterpretation>` タグを確認する。 worker_isolation_rule を守る。review_termination_condition に従い終了判定を行う：終了条件を満たした場合（`<completion_status>` が `完了` かつ指摘が一切存在しない）は step `audit_expectations` に進む。終了条件を満たさない場合は step `review_fix` を繰り返す（`<completion_status>` が `部分完了` または `未完了` の場合はその旨を次の context に含める）。
</step>
<step name="audit_expectations">
worker を呼び出す。task は human_instructions に書かれた要求が実際の成果物によって充たされているかをひとつひとつ確認し未充足があれば明記すること。 Worker Response フォーマット準拠の報告（`<human_expectation_alignment>` タグに充足状況を列挙）。orchestrator_read_obligation に従う。expectation_termination_condition に従い判定する：`<human_expectation_alignment>` に未充足の期待値が存在しない場合は step `report_completion` に進む。未充足の期待値が存在する場合は、Orchestrator は不足内容を分析し、その内容を context に含めて step `do_work` に戻る。
</step>
<step name="report_completion">
human に以下を報告する：実施内容の要約・編集ファイル一覧（worker の `<edited_files>` タグから集約する。）・期待値確認で確認した各要求の充足状況。これで workflow は完了する。</step>
</immediate_task>
