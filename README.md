# dotagents-workflow-trial

チームで要求・変更・検証結果を共有し、人がレビュー・承認できるAI開発フローを評価するための試行リポジトリです。

公開可能な試行コードと架空データだけを扱います。

## ディレクトリ構成

| パス | 役割 |
| --- | --- |
| `scripts/` | ハーネスの制御CLI、入力検証、公開処理とそのテスト |
| `skills/` | 共通入口 `scoping`・`implement` と参照資料 |
| `trial/` | 試行商品・Playwright依存とlockfile・商品検証・撮影定義 |
| `trial/evidence/` | この試行で保存した実装・ハーネス評価の検証記録 |
| `trial/artifacts/` | 商品アプリのE2Eレポート・画像・traceなどの生成物 |

試験実装の追加・変更は `trial/` 配下で行います。ルートの `package.json` とlockfileはハーネスのBun・TS開発依存を管理し、Playwright依存は `trial/package.json` と `trial/bun.lock` で管理します。ルートのCIと `check` はハーネス・試行商品の両方を検証するこのrepoの入口です。商品アプリの生成物は `trial/artifacts/` に保存し、Git管理から除外します。制御テストの集計レポートはOSの一時ディレクトリに作成し、成功・失敗にかかわらず実行後に削除します。

## 読む順序

次回の要求整理やチームの作業に使う文書は、[再利用する文書の入口](docs/README.md)から目的別に選べます。現行の手順、設計・検討案、過去の記録を区別しています。

- 通常の商品アプリ開発は、このREADMEの[セットアップと検証](#セットアップと検証)で起動・共通check・画像取得を確認し、[DEVELOPMENT.md](DEVELOPMENT.md)で変更とレビューの方針を確認します。制御CLIや実モデルの起動は不要です。
- 修正・独立評価の接続を試す実行担当は、上記に続いて[scripts/README.md](scripts/README.md)の設定・実行上限・中断手順を読みます。通常開発とは別に、隔離した作業コピーで実行します。
- 調査・要求整理からIssue作成までは、[要求整理とIssue作成](#要求整理とissue作成)のスキルを呼び出します。
- 合意済みの文書整理Issueも[implement](skills/implement/SKILL.md)で進めます。実装に伴う更新と同じ[文書更新の方針](DEVELOPMENT.md#ドキュメントの更新)で判断します。
- 検証結果は[検証記録](trial/evidence/README.md)を参照してください。

文書の正本について、セットアップや共通checkの順序と検証範囲はこのREADME、レビューや開発方針はDEVELOPMENT.md、制御CLIの操作と実行制約はscripts/README.mdに定めています。実際のコマンドと対象は[package.json](package.json)と各設定・実行入口で定義します。

設計の目的・判断原則・責任範囲と検討記録は[設計の入口](docs/design/README.md)を参照してください。

## 要求整理とIssue作成

このリポジトリを開いたCodexで、次のように依頼します。

```text
$scoping 商品一覧の並び順を次回も覚えてほしい。
```

既存IssueのURLや設計案も一緒に渡せます。スキルは現行コードと関連Issueを調べ、必要な質問への回答を待ち、合意した要求をIssueへ反映してURLを返します。案だけが必要なら「Issue本文案まで。公開しない」と指定してください。商品実装は別の依頼として扱います。

Bun、Git、対象repoを読み書きできるghの認証が必要です。調査の保存には既存のcheckout外contextDirを使います。スキル本文は[scoping](skills/scoping/SKILL.md)を正本とし、`.agents/skills/scoping`はそこへの相対symlinkです。[Codexの標準検出](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)を使い、hookや別の実行CLIは追加しません。スキルが表示されない場合はCodexを再起動してください。

## IssueからPR作成

```text
$implement 99
```

現在のrepoのIssue番号、または対象repoのIssue URLを渡します。[implement](skills/implement/SKILL.md)がCLIを起動し、初回実装、必要な文書や証拠の作成、検証、修正、独立評価、PR作成まで進めます。人の承認・マージは別です。「公開しない」場合はcommit・push・PR作成を省略します。

対象checkoutの `.dotagents.json` でrepo・remote・base branch・セットアップ・検証・撮影を指定します。[対象repoの設定](scripts/README.md#対象repoの設定)を参照してください。Bunはハーネスの実行環境であり、対象repoへBun・Playwright・`trial/`を要求しません。利用条件・実行上限・停止後の扱いは[CLI手順](scripts/README.md#issueからpr作成)を参照してください。hookを追加せず、スキルはCLIを呼ぶ入口だけを担います。

## 共通ハーネスと試行商品の検証場所

共通ハーネスは `scripts/`、`skills/`、ルートのBun・TS開発依存と基本方針です。`bun run check:harness` は制御コードのlint・書式・複雑度・型検査・制御テストを実行し、Playwrightや商品サーバーを必要としません。スキルやCLIを他repoから使う場合は、この信頼する実体を参照します。

試行商品・固定データ・Playwright依存・撮影定義は `trial/` にあります。`bun run setup:e2e` の後、`bun run check:trial` で商品のlint・複雑度・Playwright runner契約・E2Eを検証します。提出時とCIの `bun run check` は両方の範囲を引き続き検証し、片方だけの成功を共通check成功としません。

既存媒体と履歴は `trial/evidence/`、過去の設計・比較は `docs/design/archive/` と `docs/workflow-refinement/` に保持します。正規repo `thkt/dotagents` への取り込みと `~/.agents` への登録切替は後続Issueです。今回の検証分離・実測の未確認範囲と引き渡し条件は[汎用化の検証記録](trial/evidence/repository-generalization.md)に記載します。

## 提供する機能

架空の4商品を一覧表示し、商品名・商品コードで検索できます。CIとmainの保護設定を適用しています。

「並び順」で元の順序・商品名の昇順・降順を選べます。商品の読みを日本語として比較し、同じ読みでは元の相対順を保ちます。検索・クリア・全削除後も選択した順を維持します。選択時に並び順だけをlocalStorageへ保存します。同じ端末・ブラウザー・プロファイルの同一originであれば、再読み込み、タブの開き直し、ブラウザーの終了と再起動の後に復元します。検索語は保存せず、再訪時は検索欄が空で全4件を保存した順に表示します。読みは検索対象に含めません。

保存値がない場合、未対応の値がある場合、読み出しに失敗した場合は元の順序になります。保存できない場合も画面では選択した順を適用し、検索やクリアを続けられます。通知UIは追加せず、次回は以前の有効な保存値が残っていればそれを使います。「元の順序」も保存対象です。アプリ独自の有効期限は設けませんが、ブラウザーのデータ削除やプライベート閲覧終了で失われた設定は復旧しません。複数タブは即時同期せず、操作中は自分の選択を保ち、次の読み込み時に最新の保存成功値を読みます。同時操作の厳密な時刻順や、別端末・別ブラウザー・別プロファイル・別originとの同期は保証しません。

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
現行の依存Chromiumでは、「商品名・商品コードで検索」欄にフォーカスがあるときEscで検索語を空にできます。絞り込み中と該当なしのどちらの状態からでも全4件に戻り、件数表示は「全4件中4件を表示」となり、該当なしのメッセージは非表示になります。選択した並び順と検索欄のフォーカスは保持され、そのまま入力して再検索できます。空欄でEscを押しても全件表示、並び順、フォーカスを保持し、続けて検索できます。これは `type="search"` のブラウザー標準動作を使う操作で、検索欄以外からのグローバルショートカットではありません。
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
| 6. `test:trial-control` | Playwright runnerの完了判定をブラウザー不要のテストで検証します。商品側のPlaywright依存を使います。 |
| 7. `test:e2e` | Playwrightで商品アプリの表示・検索をChromiumの2画面幅で検証し、画像を保存します。詳細は以下のとおりです。 |

商品アプリの[trial/server.js](trial/server.js)と[trial/public/search.js](trial/public/search.js)はJavaScriptです。lint・複雑度検査と商品画面のE2Eで確認し、TSの書式確認や型検査の対象には含めません。BunでTSを実行するだけでは型検査になりません。模擬コマンドの制御テスト成功は、実モデルの判断品質や要求達成を保証するものではありません。

`test:control`・`test:trial-control`・`test:e2e`は[scripts/test.ts](scripts/test.ts)を経由します。`only`の指定、テスト0件、未実行件数が0以外、必要な集計の欠落を失敗と判定します。[実行完了の判定と制約](DEVELOPMENT.md#テストの実行完了)も確認してください。TSの整形やルールは[TypeScriptの書き方](DEVELOPMENT.md#typescriptの書き方)にまとめています。

`setup:e2e`は `trial/bun.lock` に従って商品側の依存を導入し、Playwrightに対応するChromiumを `trial/node_modules` 内へインストールします。
初回はネットワーク接続が必要で、LinuxではOS依存ライブラリのインストール権限も必要です。

E2Eは専用サーバーを `127.0.0.1:4173` で起動・終了します。このポートは空けてください。
[trial/tests/product-list.spec.js](trial/tests/product-list.spec.js) はIssueの固定期待値を使います。Chromiumのデスクトップ（1280×800）とモバイル（375×812）で、全4商品の名前・コード・表示順、見出しと表構造、可視性、横はみ出しの有無、ラベルで特定できる検索欄の表示を検証します。
[trial/tests/product-search.spec.js](trial/tests/product-search.spec.js) は、同じ2画面幅で上記の入力・結果・順序を検証します。キーボードだけの移動や入力ごとの更新、全削除による復帰と再検索、各状態の件数表示と検索欄のフォーカスも確認します。並び順の切り替え、検索との組み合わせ、同じ読みの相対順、再読み込み時の並び順復元も同じ画面処理で検証します。タッチ環境ではselectをtapして開き、選択の確定はキーボードで行います。これは実機の選択UIへのタップ検証ではありません。デスクトップの標準selectのキー操作は、実ブラウザで補足確認します。
[trial/tests/product-order-persistence.spec.js](trial/tests/product-order-persistence.spec.js) は、両画面幅で3種類の保存・再読み込み・タブ再オープン、検索語の非復元、0件・1件での保存、クリア・全削除、未対応値を検証します。あわせて、Storage API境界の取得・読取・書込例外、タブ間で即時同期しないこと、復元後のキーボード操作（既存のモバイルUIエミュレーションを両画面幅で使用）も検証します。OSの一時ディレクトリに永続プロファイルを作成し、Chromiumプロセスを終了・再起動して同じURLで復元することや、別プロファイルへ引き継がないことも確認します。storageStateの注入を再起動の代用にはしません。保存例外はブラウザー内のAPIに注入するテストであり、ブラウザー設定による実際の保存拒否を検証したとは扱いません。
実装のデータを期待値として取り込まず、再試行で失敗を隠しません。
Esc操作は既存のdesktop・mobileプロジェクトで検証します。検索結果あり・該当なし・空欄の各状態と3種類の並び順を組み合わせ、全件復帰、件数、該当なし表示の解除、並び順保持、検索欄のフォーカス、再検索を確認します。mobileはモバイル画面・タッチ設定でのキー入力検証であり、実機のソフトウェアキーボード対応を保証しません。
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

## レビュー用キャプチャ

ホストが通常の `bun run check` とは別に以下を実行します。`CAPTURE_OUTPUT` は必須の絶対パスで、checkout外の出力ディレクトリを指定します。

```sh
CAPTURE_OUTPUT=/absolute/path/to/capture-output bun run --cwd trial capture
```

[trial/capture.spec.js](trial/capture.spec.js) は、降順の選択から検索、再読み込みを経て、降順の復元（検索欄が空で全4件表示）までの操作を撮影します。あわせて、降順での検索結果あり・該当なし・空欄からEscで全件復帰し、再検索する操作も撮影します。[trial/capture.config.js](trial/capture.config.js) は既存のPlaywright設定のprojects・画面幅・webServerを再利用し、通常テストから撮影を分離します。PNGとWebMだけを `CAPTURE_OUTPUT` 直下へ保存し、動画contextを閉じて確定します。runnerの出力先はOSの一時ディレクトリです。撮影中にcheckoutへ画像・動画・レポートを書き込むことはありません。

ホストが収集する最終媒体の参照先（取得状況は各検証記録を参照）:

| 状態 | デスクトップ | モバイル |
| --- | --- | --- |
| 降順を復元した全件表示 | [画像](trial/evidence/generated/product-order-restored-desktop.png) | [画像](trial/evidence/generated/product-order-restored-mobile.png) |
| 選択→検索→再読み込み→復元 | [動画](trial/evidence/generated/product-order-restore-desktop.webm) | [動画](trial/evidence/generated/product-order-restore-mobile.webm) |
| 該当なしからEscで全件復帰（降順・検索欄にフォーカス） | [画像](trial/evidence/generated/product-search-escape-cleared-desktop.png) | [画像](trial/evidence/generated/product-search-escape-cleared-mobile.png) |
| 検索結果あり・該当なし・空欄からEsc→再検索 | [動画](trial/evidence/generated/product-search-escape-desktop.webm) | [動画](trial/evidence/generated/product-search-escape-mobile.webm) |

対象差分、撮影条件、実行結果、未確認事項は[並び順復元の検証記録](trial/evidence/order-persistence.md)と[Esc操作の検証記録](trial/evidence/search-escape.md)を参照してください。再撮影では上記媒体を更新し、撮影テストの標準出力に対象ファイルと媒体のSHA-256、撮影結果を記録します。撮影の成功だけでは、永続プロファイルによるブラウザー再起動や保存失敗の証拠にはしません。
