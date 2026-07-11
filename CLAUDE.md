# CLAUDE.md（Intent-First 統治原則 — 移植用抜粋）

## Intent-First Governance

This is the supreme principle of this project. All subsequent technical rules, patterns, and implementation details are subordinate to this governance. If any conflict arises, Intent always prevails.

Intent is the only non-derivable asset. While a Mechanism can be reconstructed, the Intent—the sovereign "Why"—is the sole judge of whether a change is progress or degradation. We prioritize Intent because its loss marks the irreversible end of purposeful evolution.

Intent (the logical foundation and intentional constraints behind design decisions) is the most perishable and valuable artifact in a codebase. When Intent is lost, future contributors — human or AI — cannot distinguish intentional constraints from accidental ones, and well-intentioned changes silently become degradations.

### Maintain the Intent → Contract → Mechanism hierarchy

Work flows in one direction: from Intent (user needs, business goals, and intentional design constraints given by the human) → Contract (the strict requirements and external boundaries to fulfill the Intent) → Mechanism (the internal design, architecture, and code implementation). Never let the details of a Mechanism silently alter the Contract or Intent. If a constraint in the Mechanism forces a change to the Contract, explicitly confirm with the human before proceeding.

### Recognize the fractal nature of the hierarchy

This hierarchy is recursive and applies at every level of abstraction. It is a universal structure for organizing thought and action: what is considered a Mechanism at a macro level acts as the Intent and Contract for the micro level below it. Regardless of the scale—from business strategy to a single line of code—the principle remains identical: lower-level implementation details must never silently dictate or alter the higher-level purpose.

### Reframing the Hierarchy (Mapping across Scopes)

| Scope                     | Intent (The "Why")                                                                | Contract (The "What")                                         | Mechanism (The "How")                                        |
| :------------------------ | :-------------------------------------------------------------------------------- | :------------------------------------------------------------ | :------------------------------------------------------------ |
| **Business & Product**    | Raw user needs, market goals, or problem statements.                              | Product requirements, user stories, and acceptance criteria.  | Service design, platform choice, and high-level workflows.   |
| **System & Architecture** | Architectural drivers, compliance needs, or scalability constraints.              | API specifications, data schemas, and integration contracts.  | Component boundaries, infrastructure, and technology stacks. |
| **Development & Code**    | Design patterns, logic rationale, and handling of specific edge cases.            | Interface definitions, function signatures, and type systems. | Algorithms, local variables, and actual code implementation. |

### Isolate Intent and prevent upstream contamination

Keep Intent as a distinct, standalone description — never let it blend into Mechanism-level details. Treat any pressure from the Mechanism to reshape the original purpose or constraints as a signal to stop and re-confirm with the human rather than silently accommodating.

### Build context from facts, not assumptions

Construct understanding from actual code, documentation, and investigation — not speculation. When facts are insufficient, investigate further or ask the human. Behave as a seasoned senior engineer: verify before deciding, and never proceed on uncertain premises.

### Record Intent when intentional constraints change

When a change introduces, modifies, or removes a design constraint or policy, explicitly document its Intent (the logical necessity and reasons behind the choice) in the relevant documentation. This includes adding new features or capabilities — if a feature embodies a new design decision or constraint, its Intent must be documented even if no existing documentation was modified. A change to the Mechanism alone is not complete if its Intent is absent from the corresponding documentation.

## ドキュメント運用

- いかなる作業でも `docs-use` skill を必ず使う。ドキュメント構造を把握しなければ適切なコンテキスト構築ができない。
- ドキュメントファースト：開発してからドキュメントを作るのではなく、ドキュメントを書いてから、それを実現する（CODEMAP など実情ベースで書くものは例外）。
- 章・タスクへの番号付け（Step 1:, Phase 1:, 1. 等）は禁止。名前を与える（例: `Step: {{task-name}}`）。後からの編集コストが増えるため。

## Git 非管理ファイルへのリンク

Git-managed files must not contain references to Git-excluded paths (e.g., a scratch/tmp directory) that serve as links to those files. The rule's purpose is to prevent Git-tracked content from depending on untracked resources that would be unavailable later. Exceptions: code that creates temp files there, and explanatory text about the excluded directory itself.

## Temporary Directory Conventions

一時ファイルは `<repo_root>/tmp/<subpath>/` に置く（`<subpath>` は必須。`/tmp` を直接使わない）。

## Code map

リポジトリ構成の把握には必ず `docs/CODEMAP/*.md` を参照する（`docs-use` skill 参照）。

## skill

作業の開始前・作業の途中で必要な skill を確認し、適宜必ずロードする。

---
※ 元リポジトリ（dg402）にあった「Protected repositories」節は、複数リポジトリ運用時の worktree 誤操作防止ルールであり dg402 固有のため同梱していない。単一プロジェクトでは不要。
