# IssueからPR作成までの入口

ユーザーと、`$implement 99`を薄いスキルの入口とし、実行順序・停止条件をCLIに持たせる方針を合意した。要求整理からIssue作成はscoping、合意済みIssueからPR作成はimplementで分ける。

[implementスキル](../../skills/implement/SKILL.md)は[development.ts](../../scripts/development.ts)を呼ぶ。CLIが隔離作業場所・初回実装・既存correction.tsによる検証/修正/独立評価・既存publish.tsによる公開・CI確認をつなぐ。新たなhookは追加しない。現段階は試行repoに限定し、正規.agentsへの導入と他repo対応は別の変更とする。

実装担当の判断が必要な画像・動画のPR内表示確認は呼び出し担当へ残し、未確認なら明記する。人の承認・マージは対象外。運用の正本は[CLI手順](../../scripts/README.md#issueからpr作成)。

## 検証の範囲

developmentの公開入口を実Gitの隔離worktreeで通し、モデル・GitHub・検証結果を模擬して、成功・初回実装失敗/timeout・独立評価失敗・要求変更・対象変更・公開しない指定・CI失敗・別repo拒否・未コミット保持を確認する。模擬結果を実モデルの成功証明にしない。実モデル試行の結果は後述する。

設計保存PR #79とは別の実装差分。提出対象は[Issue #85](https://github.com/thkt/dotagents-workflow-trial/issues/85)。商品実装のPR #84および要求整理入口の変更とは分ける。

## 入口追加時の確認結果

- 最新のtrial配置を含む61a002bを取り込み、未コミット差分を復元して確認した。退避stashは保持している。
- `bun run check`成功：制御92件（developmentの10ケースを含む）、E2E34件。既存のSIGINT/SIGTERM・再実行拒否の回帰テストも通過。
- quick_validate.py、相対リンク、git diff --check成功。
- Codex app-serverのskills/listでdevelopmentをrepoスコープ・有効状態で1件検出。旧implement-issueは検出されない。
- 実モデルでのIssueからPRまでの通し試行、今回差分のcommit・公開は未実施。公開には対象checkoutがcleanである必要がある。

## 呼び出し名とmainの同期

2026-09-11にmain（201b136）を取り込み、未コミット変更を復元した。スキル名と呼び出し例を`implement`へ揃え、実行処理は引き続き`development.ts`へ委譲する。上記skills/listの結果は改名前の記録。

## Issue #75の実モデル試行（2026-09-11）

ユーザーの「試してみて」を受け、直前に提示した合意済みIssue #75を対象にimplementスキルを読み、未コミットのdevelopment.tsから最新main 201b136のcleanなcheckoutを指定して実行した。スキルの自動選択・アプリUIでの`$implement`入力の検証ではなく、スキルが指定するCLIを通した試行である。

- 入口: `bun /Users/thkt/.codex/worktrees/8332/dotagents-workflow-trial/scripts/development.ts 75 --repo /Users/thkt/GitHub/cli/dotagents-workflow-trial`
- 設定: gpt-6-astra/high、初回実装を含むモデル累計20分、追加修正2回・独立評価2回、各checkとCI待機9分。
- 記録: `/Users/thkt/.local/share/dotagents/development/d3d15c767753bba6/75/`。その配下の`checkout`に実装差分を保持。
- 初回実装の実測: 348557 ms（約5分49秒）、プロセス終了コード0、timeoutなし。actorは`needs_human`を返した。
- actorは保存・復元処理、README、E2E、撮影スクリプトを作成。静的検査成功とE2E70件の登録を報告した。登録件数はテスト成功件数ではない。
- actorのworkspace-write sandboxでソケットbindが`Operation not permitted`、Chromiumが`bootstrap_check_in ... Permission denied (1100)`となり、画面検証・画像・動画取得が未完了。
- CLIは終了コード1で停止。共通check・独立評価は未実行、commit・push・PR作成も未実行。`gh pr list --head codex/development-75 --state all`は空だった。
- 保存した`implementation.stdout`に具体的な理由がある一方、CLIの表示と`stopped.txt`は`Implementation needs a decision or returned an invalid result`であり、正常なneeds_humanと不正応答を区別できていない。

実モデルの起動・隔離作業・停止と記録保持は確認できたが、IssueからPRまでの完走は未確認。ブラウザー検証・証拠取得を権限のあるホストへ引き継ぐ処理と、具体的な停止理由を呼び出し元へ伝える処理が不足している。既存runの削除・予算リセット・別runでの再試行は行っていない。

## 停止原因に対する修正案

状態: 以下の修正案に基づく実装と制御テスト、ホストでの実ブラウザー撮影を実施。修正版の通し試行は後述。

### 原因と到達点

初回担当のsandboxに権限がないブラウザー検証・撮影まで依頼し、担当が返したneeds_humanを受けて、ホスト側の共通checkへ進む前に停止した。共通checkをホストで実行する仕組み自体は既にある。新設が必要なのは主に撮影の実行接続であり、検証基盤全体の作り直しではない。

### 責任と進行

| 責任 | 入口 | 出力 | 停止と戻り先 |
| --- | --- | --- | --- |
| 実装・修正担当 | Issue、現行コード、失敗・評価の記録 | コード、意味のあるテスト、文書、必要な撮影スクリプト | 要求や許可の判断が必要ならneeds_human。ホスト担当のブラウザー実行を残しているだけなら実装準備完了として返す |
| ホスト上のCLI | 実装準備完了の差分、対象repoで定めた検証・撮影コマンド | 現行差分のcheck結果、必要な画像・動画、実行記録 | コード・テスト・撮影処理の失敗は記録を付けて修正担当へ。起動権限不足やtimeoutは環境・上限の停止として返す |
| 独立評価担当 | Issue、check結果、撮影済み媒体、対象差分 | acceptedまたは具体的な不足 | 不足は既存の修正ループへ。修正後はホスト実行からやり直す |
| 公開担当 | 最新差分に対するcheck・証拠・独立評価の成功 | commit、PR、添付、CI結果 | 公開失敗はURL等を保持して停止。PR内表示・再生の確認は呼び出し担当、人の承認・マージは人へ |

### 変更箇所

1. development.tsの初回指示とcorrection.tsの修正指示を揃える。実装担当にブラウザー起動権限があることを前提にせず、実行可能なテスト・撮影処理の準備までを依頼する。needs_humanを無条件に成功へ読み替えない。
2. ホストから必要な撮影を実行できるよう接続する。対象repoで明示したコマンドを使い、自由文のfindingsからコマンドを抽出・実行しない。サーバー起動・終了、終了コード、timeout、ログの管理には既存の処理を再利用する。今回の対象はtrialのPlaywright撮影に絞る。
3. 撮影を既存の検証・修正・独立評価ループへ組み込む。初回だけ撮影して終わりにせず、修正された差分から媒体を再生成して評価に渡す。撮影前後でソースが変わっていないことを確認し、生成媒体を含む評価対象を確定してからcheck・独立評価・公開時の同一性確認につなぐ。生成による媒体更新と、検証中の予期しないソース変更を混同しない。
4. 停止理由を分ける。正常なneeds_human、不正応答、ホスト実行不能、check/撮影失敗、timeoutを区別し、具体的な理由・次の担当・記録の場所を呼び出し元へ示す。人の判断が必要な停止や既存の回数・時間上限を維持する。

### 完了条件と確認方法

- 公開入口の制御テストで、実装準備完了からホスト撮影・check・独立評価・公開へ接続することを確認する。
- 撮影やcheckの失敗でPRを作らず、修正後に最新媒体を再生成して評価することを確認する。前回の媒体や古い評価を成功根拠に使わない。
- needs_human、不正応答、実行環境の拒否、timeoutについて、停止理由と記録を保持し、公開や無制限の再試行へ進まないことを確認する。
- 既存の共通checkを通した後、実モデルでブラウザー起動・証拠取得・独立評価・PR作成・CIまで実測する。CLIの完走と、呼び出し担当によるPR内表示・動画再生確認、人の承認を区別して報告する。

### 今回の範囲

薄いimplementスキル、既存のcorrection/publish、既存Playwrightを再利用する。新しいhook、汎用のコマンド委譲基盤、worktree管理の拡張、sandboxの一括解除は追加しない。

停止済みIssue #75のrunはそのまま保存する。修正後の検証を過去runの自動再開として扱わず、再実行する際は既存差分・消費時間・公開状態と実行条件を明示する。停止済みrunの削除や保存先変更で上限を回避しない。汎用resume機能は今回の必須修正に含めない。

## ホスト撮影の実装と確認

- `development.ts`と`correction.ts`で初回・修正の担当範囲を揃えた。実装担当は撮影用の`trial/capture.spec.js`を準備し、既存Playwright設定を用いた実行は`capture.ts`がホストで行う。
- `capture.ts`はブラウザー・待受の起動可否を先に確認する。撮影は既存画面幅・webServerを再利用し、checkout外の新しい出力先へ書く。0件・skip・失敗は成功にしない。
- 制御ループは撮影後に要求・ソースの不変を確認し、媒体を`trial/evidence/generated/`へ取り込んで対象を確定する。その後のcheck・独立評価・公開も同じ対象で確認する。修正後は撮影から再実行する。撮影中のソース変更、評価後の媒体差し替えを拒否する。
- captureの実行不能（終了コード78またはプロセス起動失敗）とtimeoutを区別して停止。撮影の通常の失敗はログとともに修正担当へ返す。初回のneeds_humanは理由を表示し、不正JSONと区別する。
- 共通check成功: 制御103件、E2E34件。後続のcheck回数集計・初回timeout表示の小修正後、関連60件・型検査・複雑度検査成功。
- ホスト撮影の実測: 現行商品アプリの隔離コピーでPC・モバイルの2ケースを実行し、画像2枚を取得。最初の確認で固定版Chromiumの参照先の誤りを検出し、Playwrightのロード前に環境変数を設定するよう修正した。記録は`/private/tmp/host-capture-probe-0flbv1g5/`、共通checkログは`/private/tmp/implement-host-check.log`。一時領域の永続保存は保証しない。

### 修正版の別試行

前回のrunは消費時間・差分・停止記録を保持したまま、修正版CLIによる別試行として開始した。旧runの自動再開や成功への書き換えではない。起点はGitHub上のmain 201b136。入力checkoutは`/Users/thkt/.local/share/dotagents/trials/implement-host-75/source`、実行記録と隔離checkoutは同じ親の`run/`。モデル累計20分、追加修正2回・独立評価2回、撮影/check/CI各9分。成果物要求は同じIssue #75。

### 修正版の試行結果

- CLIは正常終了。PR [#84](https://github.com/thkt/dotagents-workflow-trial/pull/84)、commit `ff0da713f6827c86899ed78839ceb75fedeb2b87`を作成。PRはIssue #75の商品実装であり、この作業worktreeのCLI修正を含めたPRではない。
- 初回実装380367 ms、修正1回・独立評価2回の合計381590 ms。モデル累計約12分42秒（上限20分）。撮影2回、共通check2回。
- 初回check成功後、独立評価が「媒体は存在するが文書は撮影待ちのままで来歴が不明」と指摘。CLIが修正へ戻し、文書・撮影来歴の記録を修正してから再撮影・再check・再評価。2回目でaccepted。
- 各撮影はPC・モバイル2件成功。最新共通checkは対象main由来の制御82件と、商品実装後のE2E84件が成功。CLI修正側の制御103件・E2E34件とは対象が異なる。
- CLIが画像2枚・動画2本を添付し、最新commitのCI checks/verify成功を確認。呼び出し担当がChromeのPR内で画像2枚の表示と動画2本の最後までの再生を確認した。動画はPC3.76秒・モバイル3.6秒。
- 実装・撮影・check・修正・独立評価・commit・push・PR作成・添付・CIまで、起動後に手動で工程を組み替える介入はなかった。公開後の媒体表示確認は設計どおり呼び出し担当が実施。
- 公開後、PR本文が初回実装の要約を再利用し「ホスト実行待ち」と残す不備を確認。呼び出し担当が本文を訂正し、capture-2の媒体・ソースのハッシュと条件を引き継いだ。CLIも最終評価の要約を本文に用いるよう修正。これは完走後の追加修正であり、関連12件とlint・型・複雑度検査で確認した（実モデルでの再試行はしていない）。
- ホスト撮影入口は、別の実ブラウザー確認で撮影2件のskipを終了コード1として拒否した。

上記試行終了時点ではCLI修正と設計文書は未コミット、実装PR #84は人のレビュー・承認待ちだった。前回の停止runも保持した。

## CLI修正の提出

Issue #85へ紐づけ、CLI・implement入口・関連文書を提出する。PR #84のマージを確認し、その商品実装を含む最新mainへ合わせて共通checkを実行する。要求整理スキルの未コミット変更はこのPRに含めない。
