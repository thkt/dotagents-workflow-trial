# 制御CLIの試行手順

合意したIssueに対して、check失敗または独立評価の`needs_changes`から修正・再検証・再評価へ接続する実行担当向けの入口です。この文書をCLIの操作・実行制約の正本とします。
通常の商品アプリ開発は[README](../README.md#セットアップと検証)、PRと人のレビュー・承認は[DEVELOPMENT.md](../DEVELOPMENT.md)を先に確認してください。共通check内の制御テストは模擬コマンドを使いますが、ここで説明するCLI試行は実モデルを呼びます。

## IssueからPR作成

```sh
bun /absolute/path/to/trusted/scripts/development.ts 99 --repo /absolute/path/to/checkout
```

`development.ts`が、Issue全文の取得、隔離worktree、初回実装、既存correction.tsによる共通check・修正・独立評価、commit・push・AppによるPR作成、添付、最新headのCI確認を進めます。スキルはこのCLIを呼びます。初回実装も既存codex-actor.tsを使います。

現段階の対象は`thkt/dotagents-workflow-trial`のみです。Bun・Git・gh・Codex、対象モデルの利用権限、既存のApp認証が必要です。入力checkoutはcleanな状態で使い、committed HEADから`codex/development-N`を作ります。未コミット変更や同名branchがあれば停止し、元checkoutを整理・上書きしません。依存とChromiumは隔離先へ固定版で準備します。実行する制御コードは隔離先の外に置きます。

新規実行の上限は初回実装を含むモデル累計20分、追加修正2回・独立評価2回、各checkとCI待機9分です。初回実装の消費時間を既存correction.tsへ渡す残時間から差し引きます。設定変更による予算拡大や自動復旧は行いません。

保存先は`~/.local/share/dotagents/development/<Git管理ディレクトリの識別値>/<Issue番号>/`、変更する場合は`--run-dir DIRECTORY`でcheckoutとGit管理領域の外を指定します。要求、初回実装の指示・結果、検証設定・ログ、作業checkout、PR本文・URL、CI結果を残します。既存保存先は再利用して再実行せず停止します。中断・失敗後は記録と実プロセス・GitHubの状態を照合し、保存先を削除したり別名にして自動再試行しません。

`--no-publish`では独立評価までで止め、commit・push・PR作成を行いません。通常実行は公開条件を満たす変更のみcommitし、`trial/evidence/`内で今回変更した画像・動画を既存ghで添付します。PR内の表示・再生確認は結果の`rendered_media_check`として呼び出し担当へ渡します。CI失敗・確認不能時はPR URLと記録を保持して非zero終了し、成功とは報告しません。人のレビュー・承認・マージは自動実行しません。

## ホストによるブラウザー検証と撮影

実装・修正担当はsandbox内でコード・テスト・文書・撮影定義を準備し、ブラウザーやサーバーの起動はホストCLIが担当します。ホストの実行を残しているだけなら`repaired`を返し、要求・許可の判断が必要な場合は`needs_human`で具体的な理由を返します。

画面証拠が必要な変更では`trial/capture.spec.js`を用意します。既存`trial/playwright.config.js`の画面幅・webServerを使い、`CAPTURE_OUTPUT`で渡された絶対パスの直下へ画像・動画だけを保存します。通常のE2Eとは別にホストが実行し、テスト0件・skip・失敗を成功扱いしません。撮影中はcheckoutのコード・文書を書き換えません。媒体の公開先は`trial/evidence/generated/`です。このディレクトリはホストが毎回置き換える生成媒体専用領域とし、手書きの記録は外に置きます。

`development.ts`は既存correction設定に`capture: [BUN, TRUSTED_CAPTURE_TS]`を渡します。省略した既存のcorrection実行は従来どおりcheckから開始します。撮影定義がない場合は撮影を省略し、必要媒体の不足は独立評価で判定します。撮影定義がある場合はサーバー・Chromiumの起動可否をホストで確認します。

各検証の前に、HEADからの追跡ファイルの差分と未追跡ファイルを確認します。変更が`.md`のみなら撮影と媒体の置き換えを省略し、既存媒体を保持して共通check・独立評価へ進みます。コード・撮影定義・媒体など他の変更を含む場合や、変更を判定できない場合は通常どおり撮影します。文書が参照する媒体の不足・不整合は独立評価で確認します。

撮影は各修正後にcheckout外の新しい出力先で行います。要求・ソースの不変を確認して媒体を取り込み、媒体を含む対象を確定して共通check・独立評価・公開へ進みます。撮影失敗はログを修正担当へ渡します。起動不能は`capture_unavailable`、撮影の時間切れは`capture_timeout`として停止し、ホスト側での環境確認が必要です。撮影にも各checkと同じ9分の上限とプロセスグループの中断処理を適用します。正常な`needs_human`と不正応答を区別して表示し、記録と既存の消費上限を保持します。

## 準備と実行

```text
bun scripts/correction.ts /absolute/path/config.json
```

設定は信頼する公開・実行担当が用意します。mainから隔離した作業コピーを用意し、設定・制御コード・証拠ディレクトリを修正対象の外へ配置します。以下は設定形式の例で、Issue番号・絶対パス・実行上限はその試行で合意した値を起動前に設定してください。例の値自体は新たな実行許可を意味しません。

```json
{
  "cwd": "/absolute/path/isolated-worktree",
  "runDir": "/absolute/path/evidence",
  "issue": ["gh", "issue", "view", "DELIVERABLE_ISSUE_NUMBER", "--repo", "thkt/dotagents-workflow-trial", "--json", "title,body,updatedAt"],
  "check": ["bun", "run", "check"],
  "repair": ["bun", "/absolute/path/controller/scripts/codex-actor.ts", "repair", "/absolute/path/evidence"],
  "review": ["bun", "/absolute/path/controller/scripts/codex-actor.ts", "review", "/absolute/path/evidence"],
  "repairLimit": 2,
  "reviewLimit": 2,
  "modelTimeMs": 1200000,
  "checkTimeMs": 540000
}
```

`issue`は成果物の要求を取得するコマンドです。CLI は取得結果の全文を修正・独立評価の両方へ渡します。GitHub の書き込みコマンドはこの入口にありません。

### 成果物の要求と実験の管理

成果物の Issue には、目的・変更範囲・完了条件・適用する合意済み方針を記載します。成果物に必要な検証と説明も含めます。文書整理なら、読む順序・正本の配置・リンクの整合性などを要求にし、その実験の計測や公開作業を成果物へ書き込む指示にしません。

実験を行う場合は、実験管理の Issue から成果物の Issue を参照し、比較条件・実行上限・計測項目・結果の保管と公開を管理します。通常の変更に実験管理 Issue を追加する必要はありません。実行担当はそこで合意した上限と権限を設定・実行に反映します。

`config.issue`には成果物の Issue を指定します。完了条件の理解に必要な別 Issue の本文は取得対象に含めますが、実験管理の本文を一括で連結しません。要求と実験手順が混在している場合は、実行前に Issue を分けて合意し、見出し抽出で要求を省略する運用は避けます。過去の実測を再利用する場合は元の Issue・証拠を保持し、分離した要求を新しい Issue に記録します。

実行前に`config.issue`の取得結果を確認し、必要な要求と参照内容が揃い、実験手順が成果物の完了条件として混ざっていないことを照合します。この分離は入力準備の責任であり、CLI が内容を自動判定するものではありません。

### 修正・独立評価の担当

`repair`と`review`は要求・失敗根拠を標準入力で受け取り、結果のJSONだけを標準出力へ返します。評価は`status: accepted | needs_changes`と文字列`findings`、修正は`status: repaired | needs_human`と文字列`findings`です。欠落・不正・実行失敗は停止し、成功には読み替えません。これは呼び出し間の最小の結果形式で、Issueの完了条件を置き換える契約ではありません。

付属のCodex呼び出しはAstra/highを使い、修正はworkspace-write、評価はread-onlyで新しい実行を開始します。評価者はコード・テスト・文書を読み、ホスト側checkの結果と分けて評価します。実行前にCodexへログインし、対象モデルが利用できるCLIを用意してください。GitHub Appの鍵や書き込みtokenを作業環境へ渡さないでください。

独立評価は公開・人のレビューへ渡せるかを判断します。要求の全文を読み、実装・意味のあるテスト・必要な文書・用意された画像や動画と対象の対応付けを確認します。これらの不足は修正へ差し戻します。PR作成・添付・PR内の表示確認は公開担当、人のレビュー・承認は人の担当です。これらが公開前に未実施であることだけを実装の不備とは扱わず、残る担当作業をfindingsに記してacceptedを返します。要求を免除したり、未実施の確認を完了扱いしたりしません。

修正担当は調査・修正に必要な箇所を確認し、共通checkはホストが修正後に実行します。独立評価担当は共通checkを再実行せず、要求・コード・テスト・文書の妥当性を確認します。これはCLI試行での担当分担です。

文書の更新要否と完了条件は[ドキュメントの更新](../DEVELOPMENT.md#ドキュメントの更新)を参照します。修正担当と独立評価担当で同じ基準を使います。

## 結果と再実行

- `ready_for_human_review`で終了コード0。それ以外は未達として終了コード1です。人の承認やマージ完了を意味しません。
- `state.json`に消費回数、モデル累計時間、各check・モデルの対象と結果を残します。checkの時間はモデル累計時間に含めません。
- check・モデルの標準出力とエラー、モデルへの指示を証拠ディレクトリへ保存します。CodexのJSONLは別の実行ディレクトリへ逐次保存します。
- 回数は起動前に予約します。時間超過ではプロセスグループを停止し、親プロセスの終了を待ちます。macOS/Linuxを対象とします。
- 同じ設定・証拠ディレクトリの再実行は回数を初期化しません。終端結果があれば再実行せず、対象が変わっていれば古い成功を返しません。
- SIGINT/SIGTERMでは実行中のコマンドと同一プロセスグループの子をSIGKILLで停止し、コマンド終了と出力保存を待って異常終了します。active予約を完了に読み替えず、次のコマンドへ進みません。
- 中断した予約やlockが残った場合は停止します。既存プロセス・ログ・消費量の照合が必要です。lockやstateを削除して制限を回避しないでください。完全自動再開は対象外です。

SIGKILL・OS停止は捕捉できません。CLIだけが強制終了すると、子プロセスが残る場合があります。この場合もlockまたはactive予約が再実行を拒否しますが、書き込み停止の保証とは別です。プロセスグループから離脱した子も停止保証の対象外です。

中断後は、設定したコマンド・作業ディレクトリ・開始時刻をプロセス一覧と照合し、実行が残っていれば対象を確認して停止します。その後、stateのactive・消費回数、保存ログ、現在のIssueと作業差分を照合します。保存済み時間は中断した実行の全時間を含むとは限らないため、回数だけで再開可とは判断しません。このCLIには自動復旧やlock解除の入口はありません。再開の範囲・残り実行上限を判断するまで既存の証拠を保持します。

対象はGitの追跡ファイルとignoreされていない未追跡ファイルの内容・モード・削除、および取得した要求本文です。ignoredな依存関係や生成物まで同一性を保証しません。信頼する単一実行で使い、別作業による同じcheckoutの同時更新を避けてください。

準備時の分離や記録は、同一ユーザーによる悪意ある改変へのセキュリティ境界ではありません。検証定義の弱体化は独立評価と人のレビューでも確認します。

## 検証

現在の共通checkの順序、制御TSと商品アプリJSの検証範囲は[README](../README.md#セットアップと検証)、書式・型情報を使うlint・テスト実行完了の方針は[DEVELOPMENT.md](../DEVELOPMENT.md#typescriptの書き方)を参照してください。
制御テストの実装は[correction.test.ts](tests/correction.test.ts)と[test-runner.test.ts](tests/test-runner.test.ts)です。SIGKILLのテストでは残存プロセスをテスト側で後片付けしており、CLIの自動停止保証ではありません。

制御テストの成功は実モデルの判断品質の証拠には数えません。実測結果とその対象・未検証範囲は[検証記録](../trial/evidence/README.md)を参照してください。

## PRの公開

公開担当が、push済みブランチとレビュー用の本文を指定します。Bun、ghと、macOS login Keychainに登録したApp鍵を使います。

```sh
bun /absolute/path/trusted-checkout/scripts/publish.ts --head codex/example --title '変更の概要' --body-file /absolute/path/pr.md
```

対象は`thkt/dotagents-workflow-trial`の`main`です。同じheadのopen PRがあればそのURLを返します。既存PRの本文更新、push、承認、マージは行いません。App認証を確認し、対象リポジトリ限定のtokenで`gh pr create`を実行した後、tokenを失効します。応答不明の場合はGitHub上のPRを照合してから再実行してください。

公開スクリプトはレビュー済みの信頼するcheckoutから実行し、actorが編集する作業コピーからは実行しません。強制終了・通信断による失効失敗時は、tokenの状態を別途確認します。

公開処理のテストは模擬した外部呼び出しを使い、共通check内のtest:controlで実行します。秘密鍵はメモリ内で署名に使用し、ファイルへ保存しません。

### PRへの画像・動画の添付

App で PR を作成した後、公開担当の既存の gh 認証で`gh pr edit --attach`を実行します。対象 commit で取得した画像・動画を指定します。本文を指定しなければ、既存の本文を保って添付が追加されます。

```sh
gh pr edit PR_NUMBER --repo thkt/dotagents-workflow-trial \
  --attach '/absolute/path/screenshot.png#検索結果の表示' \
  --attach /absolute/path/demo.mp4
```

添付後は`gh pr view PR_NUMBER --repo thkt/dotagents-workflow-trial --json body --jq .body`で本文を取得し、アップロード先の URL を確認します。配置を整える場合は、この最新の本文をファイルに保存して編集し、`gh pr edit PR_NUMBER --repo thkt/dotagents-workflow-trial --body-file /absolute/path/pr.md`で反映します。既存の説明と添付 URL を維持し、画像は必要に応じて table に並べます。動画の添付 URL は単独の行に置き、PR 内で再生できるようにします。

PR 画面で画像の表示と動画の再生を確認して、添付を完了とします。一部のアップロードが失敗すると、成功した添付を反映したうえでコマンドが失敗終了するため、本文を確認し、未添付のファイルだけを再実行します。
