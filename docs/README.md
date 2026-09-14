# 再利用する文書の入口

次回の要求整理やチームの作業では、判断したいことに合う文書から読みます。現在の手順と検討案を区別し、過去の試行結果だけを根拠に現在の動作を保証しません。

## 現在の操作・方針を確認する

| 文書 | 読む目的 |
| --- | --- |
| [リポジトリのREADME](../README.md) | 構成、要求整理・実装の入口、商品アプリの仕様、セットアップと検証を確認する |
| [開発とレビューの方針](../DEVELOPMENT.md) | 文書更新、検証、人の判断と承認、公開時の説明の基準を確認する |
| [共有入口の確認](../README.md#共有入口の確認) | `~/.agents/skills` の採用版と対象checkoutを確認し、共有CLIの設定・実行・公開手順へ進む |

スキルの入口は `~/.agents/skills/scoping/SKILL.md` と `~/.agents/skills/implement/SKILL.md` です。要求整理の保存・評価CLIと十分性の判断は、共有 `scoping` の実体から `references/session.md`・`references/sufficiency.md` を辿ります。ここでその手順や権限を再定義しません。

## 設計理由・検討中の案を確認する

設計文書の保存は、全文の採用や実装許可を意味しません。各文書の提案・合意・対象版・未検証事項を確認し、現在の方針は上の正本を優先します。

| 文書 | 読む目的 |
| --- | --- |
| [設計の入口](design/README.md) | 設計文書の関係と現行運用との区別を確認する |
| [アウトカム案](design/OUTCOME-draft.md) | チームとして達成したい状態を検討する |
| [開発方針案](design/development-policy-draft.md) | 根本解決、実装の範囲、品質と説明の判断原則を検討する |
| [概念と責任範囲](design/architecture-concepts.md) | ハーネス、環境、コンテキスト、合意済み資産の責任を確認する |
| [情報・合意・証拠の設計案](design/information-and-evidence-design.md) | 要求・判断・証拠の配置とレビューの考え方を検討する |
| [コンテキスト十分性](design/context-sufficiency.md) | 次の判断に必要な情報と不足の扱いを確認する |
| [周辺フローの設計案](workflow-refinement/surrounding-flows.md) | 調査、検証、説明、公開、整理の責任と終了条件を検討する |
| [文書整備の計画](workflow-refinement/documentation-flow-plan.md) | 文書をimplementで扱う理由と更新・評価の基準を確認する |
| [正規agents運用への移行案](workflow-refinement/agents-migration-plan.md) | 提案時点の新旧比較、保全・受入・復帰の条件を確認する。開始条件と過去の実測は[移行受入の記録](../trial/evidence/shared-entry-migration.md)を参照 |

## 経緯や証拠が必要なときだけ読む

以下は記録として保持します。現在の操作手順と混同せず、記録された対象版・条件での結果として読みます。

- [設計の保存記録](design/archive/README.md)：過去の設計や試行計画。
- [検証記録](../trial/evidence/README.md)：個別の実装・ハーネス評価の結果と制約。
- [ローカルCLIの試行手順](../scripts/README.md)：保持する旧App版の操作・制約。`skills/` も試行版の参照資料として保持し、通常入口には使いません。
- [P1のIssue案](workflow-refinement/p1-shared-evidence-issue-draft.md)：当時の共有・整理前確認の提案。
- [要求整理の入口追加](workflow-refinement/requirements-entry.md)、[実装の入口追加](workflow-refinement/implementation-entry.md)：入口の実装・改名時の確認記録。
- [scopingからimplementへの通し試行](workflow-refinement/scoping-implement-90.md)：Issue #90での実行条件と結果。

新しい要求や検証へ再利用するときは、現在の対象との対応を確認します。
