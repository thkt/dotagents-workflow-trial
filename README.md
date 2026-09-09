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

CIとmainの保護設定を適用済みです。[Issue #9](https://github.com/thkt/dotagents-workflow-trial/issues/9) の初期資産として、架空の4商品を表示する商品一覧を用意しています。検索は未実装です。

## セットアップと検証

Bun 1.4.2を用意して、次を実行します。

```sh
bun install --frozen-lockfile --ignore-scripts
bun run setup:e2e
bun run start
```

`http://127.0.0.1:3000` をブラウザーで開きます。終了は Ctrl+C です。
別のポートを使う場合は `PORT=3001 bun run start` とします。
画面は静的な HTML/CSS、配信は Bun です。ビルドや外部サービスは不要です。
固定データは [public/index.html](public/index.html) の `tbody` にあり、青いノート（NOTE-001）、赤いノート（NOTE-002）、黒いペン（PEN-001）、白いマグ（MUG-001）の順です。

検証は次の共通コマンドで実行します。

```sh
bun run check
```

`check` はOxlintのcorrectnessルールと、Biomeの
`noExcessiveCognitiveComplexity`（上限15）、Playwrightによる実ブラウザーE2Eを順に実行します。
Biomeの他のlintルール・formatter・assistは有効にしません。
違反や検証コマンドの失敗は終了コードに反映します。

`setup:e2e` はPlaywrightに対応するChromiumを `node_modules` 内へインストールします。
初回はネットワーク接続が必要で、LinuxではOS依存ライブラリのインストール権限も必要です。
JavaScriptを使用しており、TypeScriptの型検証はありません。

E2Eは専用サーバーを `127.0.0.1:4173` で起動・終了します。このポートは空けてください。
[tests/product-list.spec.js](tests/product-list.spec.js) はIssueの固定期待値を使い、Chromiumのデスクトップ（1280×800）とモバイル（375×812）で全4商品の名前・コード・表示順、見出しと表構造、可視性、横はみ出しの有無、検索入力がないことを検証します。
実装のデータを期待値として取り込まず、再試行で失敗を隠しません。
Firefox・WebKit・実機・支援技術の動作はこのE2Eの検出範囲外です。

スクリーンショットの再取得（E2Eも実行）:

```sh
bun run test:e2e
```

成功時に `artifacts/product-list-desktop.png` と `artifacts/product-list-mobile.png` を出力します。
`artifacts/` はGit管理対象外で、失敗時のtraceも `artifacts/test-results/` に保存します。
撮影結果は毎回上書きするため、成功した実行のものを使ってください。
画面の構成と読みやすさは人がレビューします。PRには対象commitで再実行した画像、検証コマンドと結果、未確認事項を添付してください。

GitHub Actionsの`checks` jobも同じセットアップと `bun run check` を使います。
PRのhead commitを検証します。jobの上限は`checks`が9分、`verify`が1分です（runner待ち時間を除く）。
同じPRの古い実行をキャンセルし、変更パスによる検証省略は行いません。
PRのコードを実行するjobにはAppの鍵や書き込みtokenを渡しません。

必須の`verify` jobは`checks`の結果が`success`の場合だけ成功します。
`checks`の失敗・スキップ・キャンセルを成功扱いしません。
判定jobはcheckoutせず、追加のtoken権限も持ちません。
workflow全体のキャンセルやrunner障害では判定job自体が完了しないことがあります。

mainではPR・承認1件・GitHub Actionsの`verify`成功・未解決会話の解消を要求します。
新しい差分では古い承認を取り消し、baseの更新時は最新mainとの整合を求めます。
直接push、force push、削除を制限し、bypass対象は設けていません。
人は差分と検証結果を確認してApproveします。エージェントは人の承認を代行しません。
承認後に差分が更新された場合は、最新commitの差分とCI結果を確認して再度Approveしてください。

設定と実際のPRによる確認結果は[Issue #1](https://github.com/thkt/dotagents-workflow-trial/issues/1)で追跡します。
検証定義の変更に対する人のレビュー、PRの説明方法、確認済み範囲と制約は、[検証とレビューの方針](DEVELOPMENT.md)を参照してください。
