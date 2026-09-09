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

CIとmainの保護設定を適用済みです。[Issue #9](https://github.com/thkt/dotagents-workflow-trial/issues/9) の初期資産として、架空の4商品を表示する商品一覧を用意しています。[Issue #10](https://github.com/thkt/dotagents-workflow-trial/issues/10) で商品名・商品コードによる検索を追加しています。

## セットアップと検証

Bun 1.4.2を用意して、次を実行します。

```sh
bun install --frozen-lockfile --ignore-scripts
bun run setup:e2e
bun run start
```

`http://127.0.0.1:3000` をブラウザーで開きます。終了は Ctrl+C です。
別のポートを使う場合は `PORT=3001 bun run start` とします。
画面は静的な HTML/CSS と検索用JavaScript、配信は Bun です。ビルドや外部サービスは不要です。
固定データは [public/index.html](public/index.html) の `tbody` にあり、青いノート（NOTE-001）、赤いノート（NOTE-002）、黒いペン（PEN-001）、白いマグ（MUG-001）の順です。

「商品名・商品コードで検索」欄に入力すると、入力のたびに商品名または商品コードの部分一致で一覧を絞り込みます。Enterは不要です。検索語の前後空白を除き、英字の大小文字は区別しません。

| 入力・操作 | 表示される商品（表示順） |
| --- | --- |
| 初期表示、空文字、空白のみ | 全4件 |
| `ノート` | 青いノート、赤いノート |
| `青い` | 青いノート |
| `note` | 青いノート、赤いノート |
| `  pEn-001  ` | 黒いペン |
| `存在しない商品` | 商品0件と「該当する商品はありません」 |
| 該当なしの後に入力を全削除 | 全4件に復帰し、該当なしの表示は消える |

キーボードだけでも操作できます。Tabで検索欄に移動して入力し、検索欄でCtrl+A（macOSはCommand+A）→Backspaceで全削除します。
[public/search.js](public/search.js) は行の表示・非表示だけを切り替えるため、元の固定商品データと表示順を保持し、全削除後も再検索できます。
全角・半角変換、かな変換、複数語検索、曖昧検索、通信、保存済み検索、認証、本番配布は対象外です。

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
[tests/product-list.spec.js](tests/product-list.spec.js) はIssueの固定期待値を使い、Chromiumのデスクトップ（1280×800）とモバイル（375×812）で全4商品の名前・コード・表示順、見出しと表構造、可視性、横はみ出しの有無、ラベルで特定できる検索欄の表示を検証します。
[tests/product-search.spec.js](tests/product-search.spec.js) は同じ2画面幅で上記の入力・結果・順序、キーボードだけの移動と入力ごとの更新、全削除による復帰と再検索を検証します。
実装のデータを期待値として取り込まず、再試行で失敗を隠しません。
Firefox・WebKit・実機・支援技術の動作はこのE2Eの検出範囲外です。

スクリーンショットの再取得（E2Eも実行）:

```sh
bun run test:e2e
```

成功時に次の画像を出力します。

| 状態 | デスクトップ | モバイル |
| --- | --- | --- |
| 初期表示（全4件） | `artifacts/product-list-desktop.png` | `artifacts/product-list-mobile.png` |
| `ノート` で絞り込み（2件） | `artifacts/product-search-filtered-desktop.png` | `artifacts/product-search-filtered-mobile.png` |
| 該当なし（0件） | `artifacts/product-search-no-results-desktop.png` | `artifacts/product-search-no-results-mobile.png` |

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
