# P1 Issue案：共有情報と整理前の確認を補う

[設計案](surrounding-flows.md)に沿い、必要な情報の共有と整理前の参照確認だけを短く補う。worktree固有の運用設計は追加しない。

## 合意と現状確認

- 2026-09-11：ユーザーとP1の縮小を合意し、現行のworktree関連実装に不要な細部があれば整理する依頼を受けた。このP1案の作成時点では、案の公開・マージ・作業場所の削除は実施していない。
- 調査対象HEADは`5c5ae81b3d50b1cde202ae1467060a641a436093`。repo内のAGENTS.md・OUTCOME.mdはなし。
- 初回調査で関連Issue本文を確認済み。#41はREADME・検証説明の整理、#50は要求整理の試行計画で、共有と整理前確認を直接の完了条件にしていない。関連Issueとして参照する小さな新規Issueを推奨する。公開時は最新状態と重複を再確認する。
- #73には同一保存庫・会話なしの独立担当引き継ぎが成立した1例がある。別cloneや一般的な安定性の証拠に広げない。今回その実測を繰り返さない。

## 公開用Issue本文案

### タイトル

共有する根拠と作業場所の整理前に確認することを明記する

### 目的と変更

次担当がIssue/PRから要求・根拠・検証結果を辿れ、作業場所の整理で必要な情報や未完了作業を失わないようにする。

DEVELOPMENT.mdの既存方針へ、共有する情報と整理前の確認を短く補う。要求・合意の正本、基本文書と経緯の分担は現行を維持する。session.mdは必要なら正本へのリンクだけを補い、同じ方針を二重に定義しない。

### 完了条件

- 要求・合意はIssue、必要な根拠・検証結果はIssue/PRから辿れる共有先へ残すことが分かる。短い記録はIssue/PR、長い記録は既存evidence等を利用し、公開可能な内容だけを共有する。
- 作業場所を整理する前に必要な参照を次担当が開けることを確認し、未完了の作業と必要な記録を保持することが分かる。
- ローカル保存と共有・合意を混同せず、既存の説明と重複しない。全ログの保存や新たな帳票・工程は求めない。

### 検証

文書を現行処理・既存方針と照合し、既存Issue/PRから必要な根拠を辿れるかを確認する。文書変更の提出時は既存bun run checkを再利用する。文言一致テストは追加しない。

別clone試行・実際のworktree削除は必須にしない。実際の引き継ぎで不足が出た場合に、その不足だけを確認する。変更は小さなPRにし、人がレビュー・承認する。

関連：#41、#50、#54、#73。

## worktree関連実装の確認結果

scripts・skills内のworktree、git-common-dir、repository.txtの使用箇所、discovery.ts全文と対応テストを確認した。

- `discovery.ts`の`gitDirectory`はGit標準の`rev-parse --git-common-dir`で保存庫の共有単位を識別する。別の管理器・worktree一覧・移転処理はない。
- 保存済みrepository.txtも同じ関数で解決するため、旧checkoutパス用の専用分岐はない。この処理を削ると既存保存庫の利用条件を変える。
- 保存先がcheckout/Git管理領域の外にあること、実体パス、別保存庫との混同を検査する箇所は、それぞれ保存の保護に使う。loadのcheckout存在確認も専用の整理・再開処理ではない。
- 対応テストは同じ本体を2種類の保存形式で使い、CLI入口で共有・旧評価の分離・別cloneの拒否を確認する。履歴用の別実装はない。
- `correction.ts`の証拠保存先の確認と`codex-actor.ts`の外部ログ保存は作業結果の保全に使う。

不要として削除できるworktree専用処理は見つからなかったため、コード・テストは変更しない。今回整理したのは設計・Issue案に増やしていた運用条件である。この実装調査は静的確認であり、実モデル・削除試行による検証ではない。文書保存PRの共通check結果はPR側に記録する。

根拠：[discovery.ts](https://github.com/thkt/dotagents-workflow-trial/blob/5c5ae81b3d50b1cde202ae1467060a641a436093/scripts/discovery.ts)、[CLIテスト](https://github.com/thkt/dotagents-workflow-trial/blob/5c5ae81b3d50b1cde202ae1467060a641a436093/scripts/tests/discovery.test.ts)、[session.md](https://github.com/thkt/dotagents-workflow-trial/blob/5c5ae81b3d50b1cde202ae1467060a641a436093/skills/clarify-requirements/references/session.md)、[開発方針](https://github.com/thkt/dotagents-workflow-trial/blob/5c5ae81b3d50b1cde202ae1467060a641a436093/DEVELOPMENT.md)。

## 次の一歩

この短い本文案をIssueへ反映する。公開は未実施。基本文書への反映時はIssueに紐づけ、共有・整理の方針を最小限だけ補う。
