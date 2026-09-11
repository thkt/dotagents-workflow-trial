# 設計の入口

目的・判断原則・責任範囲と、検討中の構成を参照する入口です。設計文書の保存を、その内容すべての採用や実装許可として扱いません。

## 読む順序

| 文書 | 判断すること |
| --- | --- |
| [アウトカム案](OUTCOME-draft.md) | チームとして達成したい状態 |
| [開発方針案](development-policy-draft.md) | 根本解決、必要十分な実装、品質と説明の判断原則 |
| [概念と責任範囲](architecture-concepts.md) | ハーネス・ガードレール・環境・コンテキストと合意済み資産 |
| [情報・合意・証拠の設計案](information-and-evidence-design.md) | 要求・判断・証拠の配置とレビューの検討 |
| [コンテキスト十分性](context-sufficiency.md) | 次の判断に必要な情報と不足の扱い |
| [ドキュメント整備フローの計画](../workflow-refinement/documentation-flow-plan.md) | 文書単独の整備とimplementに伴う更新の接続・完了条件・検証順序 |

## 現在の運用との関係

現在の操作・検証は[README](../../README.md)、採用済みの開発・レビュー方針は[DEVELOPMENT.md](../../DEVELOPMENT.md)、制御CLIは[scripts/README.md](../../scripts/README.md)を正本とします。要求整理の実行方法は[スキル](../../skills/clarify-requirements/SKILL.md)に従います。

この試行では全変更のマージ前に人のレビュー・承認が必要です。情報設計にあるレビュー省略の条件は検討案であり、有効な運用ではありません。各変更の採用範囲・完了条件はIssue、変更と検証結果はPRから確認します。

周辺フローの具体化は[Issue #77](https://github.com/thkt/dotagents-workflow-trial/issues/77)と[PR #79](https://github.com/thkt/dotagents-workflow-trial/pull/79)、要求整理の試行は[Issue #50](https://github.com/thkt/dotagents-workflow-trial/issues/50)から辿れます。進行状態は対応するIssue・PRで管理します。

[保存記録](archive/README.md)は、設計判断の根拠が必要なときに参照します。基本文書や現行手順へ実施履歴を混ぜません。
