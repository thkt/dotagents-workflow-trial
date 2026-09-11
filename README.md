# dotagents-workflow-trial

チームで要求・変更・検証結果を共有し、人がレビュー・承認できるAI開発フローを評価するための試行リポジトリです。

公開可能な試行コードと架空データだけを扱います。

## ディレクトリ構成

| パス | 役割 |
| --- | --- |
| `scripts/` | ハーネスの制御CLI、入力検証、公開処理とそのテスト |
| `skills/` | 要求整理のスキルと参照資料 |
| `trial/` | 試験実装の商品アプリ、固定データ、E2EテストとPlaywright設定 |
| `trial/evidence/` | この試行で保存した実装・ハーネス評価の検証記録 |
| `trial/artifacts/` | 商品アプリのE2Eレポート・画像・traceなどの生成物 |

試験実装の追加・変更は `trial/` 配下で行います。ルートの `package.json`、lint・型検査設定、CIは共通の検証入口です。商品アプリの生成物は `trial/artifacts/` に保存し、Git管理から除外します。制御テストの集計レポートはOSの一時ディレクトリに作成し、成功・失敗にかかわらず実行後に削除します。

## 読む順序

- 通常の商品アプリ開発は、このREADMEの[セットアップと検証](#セットアップと検証)で起動・共通check・画像取得を確認し、[DEVELOPMENT.md](DEVELOPMENT.md)で変更とレビューの方針を確認します。制御CLIや実モデルの起動は不要です。
- 修正・独立評価の接続を試す実行担当は、上記に続いて[scripts/README.md](scripts/README.md)の設定・実行上限・中断手順を読みます。通常開発とは別に、隔離した作業コピーで実行します。
- 合意前の調査・要求整理は[clarify-requirements](skills/clarify-requirements/SKILL.md)を明示的に読み、保存・不足・回答・再評価の手順を使います。モデルを自動起動するCLIではありません。
- 検証結果は[検証記録](trial/evidence/README.md)を参照してください。

文書の正本は、セットアップ・共通checkの順序と検証範囲がこのREADME、レビュー・開発方針がDEVELOPMENT.md、制御CLIの操作と実行制約がscripts/README.mdです。実際のコマンドと対象は[package.json](package.json)と各設定・実行入口で定義します。

## 提供する機能

架空の4商品を一覧表示し、商品名・商品コードで検索できます。CIとmainの保護設定を適用しています。

「並び順」で元の順序・商品名の昇順・降順を選べます。商品の読みを日本語として比較し、同じ読みでは元の相対順を保ちます。検索や全削除後も選択した順を維持し、ページ再読み込みで元の順序へ戻ります。読みは検索対象に含めません。

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
固定データは [trial/public/index.html](trial/public/index.html) の `tbody` にあり、青いノート（NOTE-001）、赤いノート（NOTE-002）、黒いペン（PEN-001）、白いマグ（MUG-001）の順です。

「商品名・商品コードで検索」欄に入力すると、入力のたびに商品名または商品コードの部分一致で一覧を絞り込みます。Enterは不要です。検索語の前後空白を除き、英字の大小文字は区別しません。検索欄と一覧の間に「全N件中M件を表示」と総数・該当件数を表示し、入力に合わせて更新します。初期表示と全削除後は「全4件中4件を表示」です。

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
「検索をクリア」ボタンは常時表示され、クリック・タップ・Enter・Spaceで検索を解除します。件数表示も全件に戻ります。キーボードでは検索欄からTabでボタンへ移動でき、クリア後もフォーカスはボタンに残ります。Shift+Tabで検索欄へ戻って再検索できます。
[trial/public/search.js](trial/public/search.js) は商品データを保持したまま行の表示・非表示と並び順を更新するため、全削除後も選択した順で再検索できます。
全角・半角変換、かな変換、複数語検索、曖昧検索、通信、保存済み検索、認証、本番配布は対象外です。

検証は次の共通コマンドで実行します。

```sh
bun run check
```

[package.json](package.json)の`check`は、次の順に実行し、いずれかが失敗したらそこで停止します。違反やコマンドの失敗は終了コードに反映します。

| 順序・コマンド | 現在の検証範囲 |
| --- | --- |
| 1. `lint` | Oxlintのcorrectness検査。`scripts/**/*.ts`には型情報を使う検査と書き方のルールも適用（[設定](.oxlintrc.json)）。 |
| 2. `format:check` | Oxfmtによる`scripts/**/*.ts`だけの書式確認。書き換えは行いません（[設定](.oxfmtrc.json)）。 |
| 3. `complexity` | Biomeの`noExcessiveCognitiveComplexity`、上限15。[設定](biome.json)で他のlintルール・formatter・assistは無効です。 |
| 4. `typecheck` | `tsc --noEmit`。対象は制御コード・制御テストを含む`scripts/**/*.ts`で、`strict`と`noUncheckedIndexedAccess`が有効（[tsconfig.json](tsconfig.json)）。 |
| 5. `test:control` | Bunで`scripts/tests`を実行。実際の制御CLI入口と一時Git作業コピーで、模擬コマンドによる修正・評価の遷移、対象変更、不正入力、上限、中断・再実行拒否を確認します。テストrunnerの実行完了判定も検証します。実モデルは呼びません。 |
| 6. `test:e2e` | Playwrightで商品アプリの表示・検索をChromiumの2画面幅で検証し、画像を保存します。詳細は以下のとおりです。 |

商品アプリの[trial/server.js](trial/server.js)・[trial/public/search.js](trial/public/search.js)はJavaScriptです。lint・複雑度検査と商品画面のE2Eで確認し、TSの書式確認・型検査の対象には含めません。BunでTSを実行するだけでは型検査になりません。模擬コマンドの制御テスト成功は実モデルの判断品質や要求達成の保証ではありません。

両テストコマンドは[scripts/test.ts](scripts/test.ts)を経由し、`only`、テスト0件、未実行件数が0以外、必要な集計の欠落を失敗にします。[実行完了の判定と制約](DEVELOPMENT.md#テストの実行完了)も確認してください。TSの整形・ルールは[TypeScriptの書き方](DEVELOPMENT.md#typescriptの書き方)にまとめています。

`setup:e2e`はPlaywrightに対応するChromiumを`node_modules`内へインストールします。
初回はネットワーク接続が必要で、LinuxではOS依存ライブラリのインストール権限も必要です。

E2Eは専用サーバーを `127.0.0.1:4173` で起動・終了します。このポートは空けてください。
[trial/tests/product-list.spec.js](trial/tests/product-list.spec.js) はIssueの固定期待値を使い、Chromiumのデスクトップ（1280×800）とモバイル（375×812）で全4商品の名前・コード・表示順、見出しと表構造、可視性、横はみ出しの有無、ラベルで特定できる検索欄の表示を検証します。
[trial/tests/product-search.spec.js](trial/tests/product-search.spec.js) は同じ2画面幅で上記の入力・結果・順序、キーボードだけの移動と入力ごとの更新、全削除による復帰と再検索、各状態の件数表示と検索欄のフォーカスを検証します。並び順の切り替え・検索との組み合わせ・同じ読みの相対順・再読み込み時の初期化も同じ画面の処理で確認します。タッチ環境ではselectをtapして開き、選択の確定はキーボードで行います。実機の選択UIへのタップ検証ではありません。デスクトップの標準selectのキー操作は、実ブラウザで補足確認します。
実装のデータを期待値として取り込まず、再試行で失敗を隠しません。
Firefox・WebKit・実機・支援技術・日本語IMEの変換途中の動作はこのE2Eの検出範囲外です。

スクリーンショットの再取得（E2Eも実行）:

```sh
bun run test:e2e
```

成功時に次の画像を出力します。

| 状態 | デスクトップ | モバイル |
| --- | --- | --- |
| 初期表示（全4件） | `trial/artifacts/product-list-desktop.png` | `trial/artifacts/product-list-mobile.png` |
| `ノート` で絞り込み（2件） | `trial/artifacts/product-search-filtered-desktop.png` | `trial/artifacts/product-search-filtered-mobile.png` |
| 該当なし（0件） | `trial/artifacts/product-search-no-results-desktop.png` | `trial/artifacts/product-search-no-results-mobile.png` |

`trial/artifacts/` はGit管理対象外で、失敗時のtraceも `trial/artifacts/test-results/` に保存します。
撮影結果は毎回上書きするため、成功した実行のものを使ってください。
画面変更時の画像・動画の添付と人の確認は、[レビューを助ける説明](DEVELOPMENT.md#レビューを助ける説明)に従います。

CIも共通checkを使います。[CIとmain保護](DEVELOPMENT.md#ciとmain保護)に実行条件・時間上限・承認条件と限界をまとめています。
