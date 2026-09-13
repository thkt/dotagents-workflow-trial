# 共通入口の汎用化の検証記録

対象はIssue「scoping・implementを他repoでも使えるよう汎用化する」の作業差分。正規repoへの取り込み・ホスト登録切替は後続Issueの対象であり、未実施。承認された別repoへのIssue・PR公開は、以下の実測結果として区別する。受入commitはホストの検証と人のレビュー後に確定する。

## 実装と責任の分離

- 対象checkoutの `.dotagents.json` を実装・公開入口で読み、GitHub repo ID、Issue URL、fetch/push remote、base branch、ghの主体と権限を照合する。設定・主体・HEAD・branchが変われば停止する。PRはホスト設定の専用Appが作成する。
- セットアップ・検証・必要媒体は対象設定に従う。文書だけでも検証を省略せず、必要媒体を指定した場合は撮影する。未設定check、欠落した撮影定義、空の媒体出力は通過させない。
- ハーネスの依存・型検査・制御テストはルートと `scripts/`、共通スキルは `skills/`。Playwright依存・商品コード・商品検証は `trial/`。既存媒体と履歴は元の場所に保持する。
- 旧の全調査監査、質問・回答のruntime所有、公開intentの機械的拘束、自動再開、旧state変換は追加していない。

## 検証定義の変更と検出条件

| 変更 | 削除した場合に見逃す不具合と残る検証 |
| --- | --- |
| 開発入口の既存fixtureを対象設定対応へ更新 | 誤ったrepo・Issue・push先の選択、未設定検証、App権限不足での実装開始を検出する。dirty入力・既存runの衝突・要求変更・修正上限・公開前の対象変化の既存検証は維持する。 |
| Bun/Playwright/trialを持たない別repoのfixture | `team/component`、`release`、`upstream` の一時Git checkoutでシェルによるsetupとcheckを実行する。fixtureにはREADME・DEVELOPMENT・package.json・trial構成がなくても共通入口が動く。実モデルとGitHub APIは模擬なので、実スキル運用・認証・公開の実測の代用にはしない。 |
| 公開テストのApp・installation・token対象・作者の照合 | 別App、権限のないinstallation、別repoのtoken、個人作成の既存PRの再利用を拒否する。tokenのrepo限定と失効、公開失敗時の停止は従来から維持する。固定したテスト用PEMは削除し、その場で生成した鍵でfingerprint不一致と設定したissuerを検証する。秘密鍵を保存しない。 |
| 必須撮影・保存先・空出力の境界 | Markdownが画面入力となるrepoでも撮影を実行し、設定した場所へ取り込む。空出力で古い媒体を削除したり評価へ進んだりしない。trialの文書だけの変更時の媒体保持と、コード・定義・媒体・symlink・実行属性による再撮影は維持する。 |
| Playwright runnerの5ケースを `trial/control/` へ移動 | normal・only・skip・failure・emptyの検出条件は削除していない。共通のfixture生成だけを `scripts/tests/support/runner.ts` へまとめ、Bun runnerとレポートの不正集計拒否はハーネスに残した。Playwright実行は `test:trial-control` が担い、共通checkが必ず呼ぶ。ブラウザーは起動しない。 |
| `check:harness` と `check:trial` の追加 | 単独のharness checkは商品E2EとPlaywright runnerを検証しない。単独のtrial checkはハーネスTS・制御テストを検証しない。提出用の共通checkは両方を検証し、元の検出条件を維持する。分離による省略を共通check成功として報告しない。 |

新しいケースは既存の停止・公開・媒体fixtureを再利用し、外部サービスや実モデルを呼ばない。追加の保証は誤った対象への実行・公開と必要検証の省略を防ぐ境界に絞った。移動したrunnerケースを両方の入口で二重実行せず、テスト件数やカバレッジ維持のための重複は追加していない。この汎用化実装では商品E2Eの期待値・projects・撮影specは変更していない。媒体は後続のホスト撮影で更新されたため、[現行媒体の来歴](search-escape.md#ホスト実行対象差分と媒体の照合)を参照する。

## 初回実装sandboxでの確認

変更した開発・公開・撮影・制御・プロセス停止・runner契約の7ファイルを指定したBunテストは成功した。Playwright runner契約は通常のJavaScriptテストのみを実行し、ブラウザー・サーバーは起動していない。型検査、ハーネスとtrialのlint・複雑度検査、TS整形も実施した。

`trial/bun.lock` は既存lockfileから同じPlaywrightと依存の固定版・integrityを引き継いだ。書込可能な一時cacheで `bun install --cwd trial --frozen-lockfile --lockfile-only --offline --ignore-scripts` の成功を確認した。sandboxの既定cacheではEPERM、空の一時cacheからの実インストールは依存未取得で失敗した。この時点ではホストの通常setupで商品依存とChromiumを導入し直す必要があった。

独立評価は要件・コード・テスト・文書を読み、SSH transportでghと別主体がpushする条件と、個人作成PRを再利用する条件を指摘した。照合済みHTTPS URLでのpushと、既存PRのApp作者照合を追加し、公開テストを再検証した。

Pythonのスキル検証CLIはPyYAML未導入で起動できなかった。frontmatter・名前・説明・未完了の指示・相対参照は別途確認する。これはスキルを実モデルで前向きに試行したという意味ではない。

## ホストと後続Issueへの引き渡し

初回実装は20分の上限で停止した。保存差分は保持し、依頼者の再開指示を受けてホスト確認と独立評価を別の記録で実施した。元のtimeout記録を成功に変えていない。

停止後のホストでは `bun run setup:e2e` と共通の `bun run check` が成功した。lint・整形・複雑度・型検査、ハーネス141件、商品runner 5件、商品ブラウザーE2E 45件を確認した。新capture CLIを既存の `trial/capture.spec.js` と `trial/playwright.config.js` で別出力先へ実行し、4件成功、skip・unexpected・flakyは0、PNG 4件とWebM 4件を生成した。この初回撮影では既存媒体を置換していない。その後、`108/resume-20260913/verification-108-content-fixed/capture-2` の収集でWebM 4件が置換された。現在のPNG 4件・WebM 4件は[撮影対象・設定・結果・ハッシュの照合記録](search-escape.md#ホスト実行対象差分と媒体の照合)に対応し、9月12日の原ログとハッシュは履歴として保持する。撮影成功は公開PRの画像表示・動画再生の確認とは区別する。

今回は依頼者の明示指示により、実測Issue・変更文書・PR本文のGemini確認を省略し、独立した内容確認を行う。Geminiの利用不能や確認済みとは記録しない。この実測固有の指示であり、共通スキルの通常方針を変更しない。ホストは候補ハーネスの実行コピーを保持し、文章確認コマンドだけを別のread-only Codex内容確認へ渡す。入力と根拠のhashに対応する実際の確認結果を保存する。対象照合、実装、対象check、独立評価、App公開、CIは候補ハーネスの経路を使う。

別repoの実測は、Bun・Playwright・trial構成と依存パッケージを持たない既存の非公開Node標準テスト用repoを選び、依頼者が変更・公開範囲とApp対象追加を承認した。対応する試行Issueに実行対象、最小の関数・テスト・README・CI変更、設定の事前準備、公開範囲とマージ対象外を記載し、独立確認・Issue反映・再読を完了した。既存Appの選択repoに承認された1件だけを追加し、従来の対象と合わせてアクセスを確認した。実モデルによる隔離実装、対象check、独立評価、専用AppでのPR作成まで実行した。公開直後はcheck未登録でCLIが停止し、後続の読み取り確認で同じheadのCI成功を確認した。CLI単独でCI待機まで完走したとは扱わない。非公開の識別情報・ソース・本文・生ログはこの公開repoへ転載しない。

後続のdotagents移行Issueには、人が受け入れたcommit、対象設定方式、App設定方式、上記の検証分離とホスト実測結果を渡す。既存checkout・worktree・保存データ・履歴と現在の登録を保持し、担当者が移行する差分、登録の切替先、保全対象、元の登録・受入commitへ戻せる条件を確認する。このIssueでは登録切替や旧データ削除をしない。

## 実測した版と設定

実行コピーは基準commit `28642977a02518f79c6729af550ddf8c191b0fc5` 上の本Issueの保存差分から作成した。ホストが保存したファイルhash一覧のSHA-256は `4264e46fb7b483396556201fc1ab18ea520df11c52112cf905960f16c76d9f71`。実測直後は実行コピーの `scripts/` と `skills/` の一致を照合した。その後の独立評価で `scripts/input.ts` の必須撮影コマンド欠落拒否と `scripts/tests/correction-capture.test.ts` と、その説明である `scripts/README.md` を追加修正したため、現在の提出差分と実測版はこの3ファイルが異なる。別repoの実測は修正前の版の結果であり、追加修正は関連53テストと修正後の共通checkで検証した。受入commitは人のレビュー後に決まるため、基準commit単独を採用版と呼ばない。

匿名化した対象設定は次のとおり。実際にはrepo名を設定し、repo ID・remote・base branch・主体・権限を実APIで照合する。実行元の設定は隔離した作業元で事前にローカルcommitし、最終PRの差分にも含める。

```json
{
  "repository": "<approved-private-owner>/<approved-node-test-repository>",
  "remote": "origin",
  "baseBranch": "main",
  "setup": [],
  "check": ["node", "--test"],
  "capture": null
}
```

ホストはNode.js v26.8.2、対象CIはNode.js 24 LTS。対象repoへBun・Playwright・依存パッケージを追加しない。ハーネス自体はBunで実行する。文章確認だけは上記のユーザー指定による独立内容確認であり、通常のGemini経路の実測結果には含めない。

## 別repo実測の結果

実装モデルは約95秒で終了した。対象のNode標準テストは2件で指定5入力を確認し、成功した。独立評価が採用ハーネス版の記録不足を検出したため、制御CLIの修正1回で版と設定の対応を補い、再度の文章確認・check・独立評価2回目で受入可能となった。媒体不要の設定では撮影やPlaywrightは呼ばれず、対象の依存パッケージも増えていない。

専用AppがOPEN・非draftのPRを作成した。作成直後の `gh pr checks --watch` はcheck未登録を返し、CLIは `pending_or_failed` で停止した。その後、ホストが同じhead・base・App作者を再読し、pull_requestによるNode 24 CIの成功と `gh pr checks --watch` の終了成功を確認した。停止済みのCLI結果・上限・ログは変更していない。新規PRのcheck登録を待つ部分は、今回ホストの後続確認を要した制約として残る。

人へは実測PRと実行条件・検証結果を提示する。レビュー・承認・マージは未実施。旧Issue・旧PRはOPENのまま保持し、対象repoのmainや公開範囲も変更していない。非公開のPR参照とCI原記録はホスト側に保持し、このIssueからは本記録の匿名化した設定・結論を参照する。

## 必須撮影設定と欠落specテストの修正

独立評価で指摘された2点を修正した。`captureRequired: true` でcapture commandがない設定を、設定読込時に拒否する。追加したCLIテストは修正前に成功終了してしまうことを確認し、修正後は停止理由、ソースの保全、run未作成を確認した。このケースを削除すると、必須撮影を省略してcheck・評価を通過する不具合を見逃す。外部サービスを使わず、修正後の単体実行は約56msだった。

欠落specテストは既存ケースを修正し、checkout外の出力ディレクトリと有効な設定ファイルを先に用意した。ENOENTに加えて欠落specの絶対パスを確認するため、別の入力の欠落では通過しない。このケースを削除すると、specの事前確認がなくなっても検出できない。実行は約38msで、ブラウザー・サーバーは起動しない。ケースの重複追加や検出条件の削除はなく、必須撮影の実行・保存先・空出力拒否・再撮影と既存の停止条件の検証を維持した。

`bun test scripts/tests/correction-capture.test.ts scripts/tests/correction.test.ts` は53件成功した。lintが指摘したテストの不要なawaitを除いた後、変更した2ケースを再実行して成功し、変更TS 2ファイルのoxlint・Biome・oxfmt検査も成功した。共通check、ブラウザー検証、撮影、修正後の独立評価、更新文書の独立内容確認はホストへ引き継ぐ（Geminiは依頼者の指示で省略）。今回の修正作業ではcommit・push・公開を行っていない。

設定済みの撮影コマンドは `bun {harness}/scripts/capture.ts trial/capture.spec.js trial/playwright.config.js ABSOLUTE_OUTPUT`。最後の引数にはcheckout外の新規絶対出力ディレクトリを渡す。既存specはそこへdesktop・mobileのPNG各2点、WebM各2点を保存し、動画contextを閉じて確定する。最終参照先は `trial/evidence/generated/`。今回、撮影定義と既存媒体は変更していない。

## 最後のホスト確認と残る受入

追加修正後のcapture-2は4件成功し、check-3も成功した。共通checkはハーネス142件、商品runner 5件、商品E2E 45件を実行した。独立評価2回・修正2回を消費して `execution_limit` で停止したため、最新差分の最終独立評価とPR公開は未実施。停止stateは保持し、成功状態へ書き換えていない。最後のホスト来歴更新は最新媒体のハッシュ・時刻・参照を反映し、実測版と追加修正の差も明記したもので、独立確認は未実施である。
