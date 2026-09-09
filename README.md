# dotagents-workflow-trial

チームで要求・変更・検証結果を共有し、人がレビュー・承認できるAI開発フローを評価するための試行リポジトリです。

公開可能な試行コードと架空データだけを扱います。

## 開発の前提

- 小さな変更もIssueに紐づけます。
- 自動化によるPRは専用GitHub Appが作成し、人がレビュー・承認します。
- 変更内容、検証結果、未確認事項をPRに記録します。
- 秘密鍵やtokenをコード・文書・ログに残しません。

## 現在の状態

初期整備は [Issue #1](https://github.com/thkt/dotagents-workflow-trial/issues/1) で進めています。

CIとmainの保護設定を適用済みです。商品一覧・検索機能は未実装です。

## セットアップと検証

Bun 1.4.2を用意して、次を実行します。

```sh
bun install --frozen-lockfile --ignore-scripts
bun run check
```

`check` はOxlintのcorrectnessルールと、Biomeの
`noExcessiveCognitiveComplexity`（上限15）を実行します。
Biomeの他のlintルール・formatter・assistは有効にしません。
違反や検証コマンドの失敗は終了コードに反映します。

現時点ではアプリのコードがないため、Oxlintの対象ファイル0件は許容します。
この結果はアプリの動作やテストの十分性を保証しません。
実装を追加するPRで、要求に対応したテストや型検証を共通の`check`へ組み込みます。

GitHub Actionsの`CI / verify`も同じコマンドを使います。
PRのhead commitを検証し、1実行の上限は10分です。
同じPRの古い実行をキャンセルし、変更パスによる検証省略は行いません。
PRのコードを実行するjobにはAppの鍵や書き込みtokenを渡しません。

mainではPR・承認1件・GitHub Actionsの`verify`成功・未解決会話の解消を要求します。
新しい差分では古い承認を取り消し、baseの更新時は最新mainとの整合を求めます。
直接push、force push、削除を制限し、bypass対象は設けていません。
人は差分と検証結果を確認してApproveします。エージェントは人の承認を代行しません。

設定と実際のPRによる確認結果は[Issue #1](https://github.com/thkt/dotagents-workflow-trial/issues/1)で追跡します。
このCIだけで検証の改変・jobの削除やスキップを防げるとは扱いません。
