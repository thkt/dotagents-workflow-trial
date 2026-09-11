# 実行環境とGitHubの能力調査

> 保存された設計・試行記録です。本文の進捗・提案・実行上限は記録当時のものです。現在の操作や権限には適用せず、[設計の入口](../README.md)から現行手順を確認してください。

2026-09-09に、[最小の実行構成案](execution-design.md)に必要な能力を読み取り調査した。ローカルのCLI・SDK、GitHub API、公式ドキュメントを確認した結果である。モデルの新規実行、障害注入、設定変更、公開操作は行っていない。実測が必要な動作は未確認として残す。

## 現在確認した環境

- 作業リポジトリ：`thkt/dotagents`、ローカルHEAD `5aafabc944bf78e6d0b7b224ae3ae207eca475fb`。
- `codex --version`：`0.153.4`。`exec`、`exec resume`、`exec review`のヘルプを確認した。PATHエイリアス作成の権限警告は出たが、ヘルプ取得は成功した。
- インストール済みTypeScript SDK：`@openai/codex-sdk` `0.149.1`。ローカルの型定義と起動部分を確認した。SDKが起動するCLIとPATH上のCLIが同じとは仮定しない。
- `gh --version`：`2.100.0`。
- GitHub API：public repository、default branchは`main`。rulesets取得は`[]`、`main`のbranch protection取得はHTTP 404で`Branch not protected`。現在の認証にはadmin権限が含まれる。
- 現在のローカルHEADに追跡された`.github`ファイルはない。`bun run check`は定義されているが、今回CIの実行成功や他の外部CIの有無は検証していない。

APIの通常実行は接続に失敗したため、許可されたネットワーク実行で同じ読み取りを行い上記を確認した。認証情報自体は取得・記録していない。

再確認に使える読み取り：`codex exec --help`、`codex exec resume --help`、`codex exec review --help`、`gh api repos/thkt/dotagents/rulesets`、`gh api repos/thkt/dotagents/branches/main/protection`。この状態は取得時点のもので、チームの導入先も同じ設定とは限らない。

## 既存機能と不足の対応

| 必要な能力 | 確認できた既存機能 | 追加設計・未確認事項 |
| --- | --- | --- |
| 作業と独立した評価の起動 | CLIの別実行、レビュー対象指定、read-only sandbox。 | 要求・対象コード・証拠を選んで渡し、評価中の対象を保全する配置が必要。別実行だけでは意味的な独立性を証明しない。 |
| 実行の観測 | CLIのJSONL出力、SDKのイベント列・usage・実行結果。 | 必須検証は制御側でも実行・結果取得し、モデルの完了メッセージと区別する。 |
| 再開・停止 | CLIのsession IDによるresume、SDKの`resumeThread`と`AbortSignal`。 | 再開時のIssue・差分・外部結果の照合、子プロセスの停止完了、応答不明の操作の扱いは実測が必要。 |
| 作業権限 | Codexのsandbox設定、GitHub側の権限・保護機能。 | filesystem制限をGitHub APIの権限やIssueの意味的な範囲制約と同一視しない。作業担当へ管理者資格情報をそのまま渡す構成を避ける。 |
| PR・検証・承認の強制 | GitHubのrulesetsで要求できる機能がある。 | dotagentsでは現在未設定。検証の発行元、bypass、承認者、更新後の承認を含めた導入設定が必要。 |
| Issueに対する合意・達成判定 | IssueやPRは記録先として使える。 | 今回の合意対象とコード・証拠の対応、Issueだけが変わった場合の再評価は独自の接続が必要。commit SHAだけでは要求の変化を検出できない。 |
| 失敗後の修正と人への引き渡し | Codexを再度実行し、結果を入力できる。 | 原因と証拠を渡し、修正・調査・再合意・停止へつなぐ制御が必要。回数や形式を増やす前にケースで必要性を確認する。 |
| 合意済み資産によるレビュー省略 | 汎用的な完成機能としては確認できていない。 | 対象資産、利用条件、逸脱検出、事前合意、人のレビューへの復帰を具体化する。標準のrequired reviewと条件付き省略の両立方式は未確認。 |

## Codexの入口の比較

CLIは`--json`でイベントを出力し、`--output-schema`で最終出力の形を指定できる。これらは観測・受け渡しの手段であり、JSONに適合したことを品質の合格とは扱わない。[公式：Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)

| 入口 | 今回の位置づけ |
| --- | --- |
| CLI | 最小の比較基準。プロセス起動、JSONL読み取り、session IDの保存・再利用を自前で扱う場合の負担を見積もる。 |
| TypeScript SDK | 型付きの起動・イベント・再開を使い、CLI呼び出しの重複実装を減らせる候補。ローカル版はCLIを子プロセスとして起動しており、SDK自体が要求合意やマージの制御を完成させるわけではない。 |
| App Server | 独自クライアントで途中入力・承認要求・割り込みを扱う必要がある場合の候補。プロトコル対応と運用負担を伴うため、初期構成の必須にはしない。 |

SDK公式文書は、ローカルthreadの開始・継続・再開を提供すると説明している。独自の対話クライアントにはApp Serverを案内している。[公式：Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)

App Serverには`turn/steer`、`turn/interrupt`、承認要求への応答、レビュー開始が記載されている。一方、公式文書にはapp-server commandとWebSocket transportの実験的・production unsupportedという注意もあるため、導入時には対象版と使用範囲の成熟度を再確認する。今回プロトコルの実動作は試していない。[公式：App Server](https://learn.chatgpt.com/docs/app-server)

設計上の推奨は、CLIを比較基準にし、TypeScriptで制御を実装するならSDKが重複を減らすかを評価すること。SDKを排除する理由も、現行依存だから継続する理由もない。実行バイナリの版・モデル対応は導入時に確認する。

## GitHubの強制と設計上の注意

rulesetsにはPR、必要なレビュー、古い承認の失効、必須status checks、チェック発行元の指定がある。bypass権限も設計対象になる。まず通常の人の承認と必須検証を強制する構成を作り、条件付きレビュー省略のためだけに広いbypassを付与しない。[公式：Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)

GitHubのジョブはスキップ時に成功として扱われ、必須チェックでもマージを阻止しない場合がある。必須検証が実際に走り成功したことを確認する条件を設計する。作業担当が検証定義や基準を弱めて合格を作れないよう、変更と評価・承認を分ける。[公式：Status checks](https://docs.github.com/en/pull-requests/reference/status-checks)

「人の承認または合意済み省略条件」という条件全体を単一の標準設定で表せるかは、今回確認できていない。GitHub App等による判定も候補になるが未採用。承認者、資格情報、発行元、ルール変更権限を含めて検討する。botの形式的な承認を人のレビューとして偽装する方式は使わない。

## 計画への反映

GitHub Actionsを検証・文書整備・環境維持の実行基盤とする追加案は、[実行構成案](execution-design.md)に記載した。以下はその判断に使った公式仕様であり、今回の環境で設定・実行した結果ではない。

- Environmentはデプロイ先を表し、ジョブの承認・対象branch・secretsへのアクセスを制御できる。利用できる保護機能は導入先のプランと可視性を確認する。[Deployment environments](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments)、[Triggering a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- workflowはイベントや条件から起動できる。自動生成した変更が次の検証を起動するかは、イベント・トークンの仕様を確認し、実際の再実行を検証する。[Triggering a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- 権限を持つ`pull_request_target`等の処理で、未信頼のPRコードを取得・実行すると資格情報を利用される危険がある。生成や投稿の権限と検証対象の実行を分ける設計根拠とする。[Securely using pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)

1. 起動・イベント・sessionの機能は既存のCodexから使う。巨大な独自ランタイムを先に作らない。
2. GitHub側へPR・必須検証・人の承認の強制を置く案とし、具体的な設定と対象プロジェクトの権限を別途確定する。
3. 追加実装は、合意・対象・証拠の対応、検証と評価の起動・差し戻し、共有・再開・外部操作の照合に絞って見積もる。
4. 人のレビュー省略は、標準経路と合意済み資産の検出力を評価してから追加する。現段階で許可しない。
5. 次の検証計画では、検証スキップ、要求だけの変更、評価中のコード変更、承認後の変更、中断と応答不明、基準の弱体化を含める。

これは能力調査に基づく提案であり、SDK選定・GitHub設定変更・実装開始の決定ではない。
