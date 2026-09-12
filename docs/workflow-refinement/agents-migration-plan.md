# 正規 `.agents` 運用への移行案

現時点では、既存 `.agents` をこの試行repoで上書きする条件は揃っていない。新しい `scoping`・`implement` を移行候補とし、既存の実行環境・保存状態・証拠を保持したまま、対象repo、登録方法、公開主体、引き継がない保証を決めてから切替を判断する。本書はそのための比較と準備案であり、実際の移行手順を実行する許可ではない。

## 位置づけと確認範囲

**合意済み**なのは、この移行案の作成・検証と設計の入口への追加である。依頼者がCodex会話で承認した範囲は本Issue「docs: 正規agents運用への移行案を現行資産に基づいて作成する」の目的・合意、変更範囲、完了条件を正本とする。登録の切替、既存資産の削除、コード・設定の変更、実際の移行は合意していない。継続方針は [DEVELOPMENT.md](../../DEVELOPMENT.md)、周辺責任の検討は[周辺フローの設計案](surrounding-flows.md)に従い、ここで再定義しない。

以下の「事実」は2026-09-12に読み取りで照合したコード・設定・文書の定義を指す。「提案」は採用判断が必要な移行先、「未決定」はその判断がないもの、「未検証」は実行確認をしていないものを指す。コードからの推論は推論と記す。

| 比較対象 | 対象版とローカル差分 | 根拠の読み方 |
| --- | --- | --- |
| 新：この試行repoの現行main | `767017253f19129b8b8d7d848a2fcb678a2e9edf`。調査開始時のHEADと一致し、作業差分なし | 本書の相対リンクは新側。後日の変更と比較するときは、このcommitの同じ相対パスを読む |
| 旧：実行ホストの既存 `.agents` checkout | `$HOME/.agents` を読み取り専用で確認。HEADは `5aafabc944bf78e6d0b7b224ae3ae207eca475fb`、追跡ファイルの変更なし | 「旧」のパスはすべてこのcheckout相対。[旧側の出典](#旧側の出典)のまとまりからコードへ辿る。新repo内へのリンクではない |
| 旧側のローカル資料 | 未追跡は `docs/design/README.md`。SHA-256: `82582b8dca59a3dc7262eecce5feb39cc14ae1559948b2583503b2e0dbb0aa4c` | 新側の設計入口（`58899422f0b162a9c449cf98f005dd1e284a84e1`）とPR #81を案内する移管メモ。旧commitに含まれる設計や、移行の採用済み合意とは扱わない |

調査は追跡資産と上記ローカル資料、保存・実行・公開処理の静的確認まで。ホスト全体のスキル一覧、PATH上の実体、hook登録、認証アカウント・鍵の有効性、全保存庫の内容、稼働プロセス、GitHubの現時点の保護設定は監査していない。秘密情報や生ログは取得・転記しない。登録されていることとrepoに定義があること、既存テストがあることと今回成功したことを区別する。

読む順序は、次の資産比較、フロー比較、実行条件・保存互換性、最後に切替判断とする。現在使えるコマンドは [scripts/README.md](../../scripts/README.md) と旧 `workflows/README.md`・各スキルを正本とし、本書に操作一覧を複製しない。

## 責任ごとの移行候補

分類は全ファイルの移動指定ではない。「置換候補」も受入条件と別の採用合意が揃うまでは旧資産を保持する。「試行用に分離」は、直ちに別repoへ移す意味ではなく、正規運用の必須資産と混同せず現在のrepoで保存する提案である。

| 責任・現行資産 | 何から何へ・分類（提案） | 理由・残る判断と根拠 |
| --- | --- | --- |
| 要求調査・設計・Issue化：旧 `research`・`think`・`issue` | 新 [scoping](../../skills/scoping/SKILL.md) と [discovery.ts](../../scripts/discovery.ts) への**置換候補**。旧の監査済み報告・Plan・Issueは**保持** | 担当者が調査・対話・合意をまとめる責任は対応するが、旧の必須監査、質問の永続化、公開承認の機械的な拘束まで同じではない。下表で失う保証を判断する（旧1・旧2） |
| Issue実装・自己評価・独立評価・公開：旧 `build` と execution | 新 [implement](../../skills/implement/SKILL.md)、[development.ts](../../scripts/development.ts)、[correction.ts](../../scripts/correction.ts) への**置換候補** | 新側はIssue全文・共通check・独立評価へ集約。旧のJSON Planを消して既存Issueを書き換える必要はなく、合意・範囲・検証を読み直して引き継ぐ。旧Buildの途中実行は新CLIで再開しない（旧2・旧3） |
| Issueなしの直接実装：旧 `code` と testing/source-verification等の参照資料 | **未決定・旧を保持** | 新 `implement --no-publish` も合意済みIssueが必要で、旧Codeの代替ではない。新 `correction.ts` も設定済み修正・評価の入口であり、直接依頼の同等アダプターではない。全変更をIssueに紐づける新方針との適用範囲を決める（旧1・旧3、[方針](../../DEVELOPMENT.md)） |
| マージ後の保全・整理：旧 `cleanup` | **未決定・旧を保持** | 新側に同等CLIはない。旧はShip receipt、非破壊preview、対象digestへの承認、recoveryを伴う整理を扱う。新PRから旧cleanupがそのまま使えるとは扱わない（旧4、[周辺案](surrounding-flows.md)） |
| 明示起動の承認・タスク束縛：旧 workflow hook | 新のスキル入口と担当者の合意確認への**置換候補、保証の扱いは未決定** | 新repoにはhooks定義がない。旧hookを残すだけで新CLIも保護される、または削除しても同じ強制力が残るとはいえない（旧5、[scoping](../../skills/scoping/SKILL.md)、[implement](../../skills/implement/SKILL.md)） |
| 編集直後の整形・lint：旧 post-edit hook | 新の共通checkへの**置換候補** | 旧は編集後にfix/writeを行う。新checkのlint・format:checkは検証であり自動修正hookではない。日本語textlint等も同じ検出範囲にはならない（旧5・旧7、[検証範囲](../../README.md#セットアップと検証)） |
| CLI名・入力検証・成果物検証・PR本文補助 | **旧CLIを保持**し、新は `bun scripts/*.ts` を別入口として扱う | 旧packageの11個のbinと新2スキルは一対一ではない。旧Plan validator、artifact verifier、PR本文・画像sealの責任も旧呼び出し元とともに残す。互換aliasの追加は未実装（旧3・旧7） |
| repoへの指示・スキルの表示・翻訳 | 新 `skills/` 正本と `.agents/skills/` 相対symlinkを候補に、旧 `AGENTS.md`・`.codex/OUTCOME.md`・`.ja/`・各 `agents/openai.yaml` を**保持、適用先は未決定** | 新 [設計案](../design/README.md) は旧OUTCOMEの自動置換ではない。旧6スキルは暗黙呼び出し禁止を明示、新2スキルのyamlは表示情報のみ。新側には旧相当のroot AGENTS指示や翻訳一式はない（旧1・旧7） |
| 調査の原本・派生索引・実行状態 | 旧corpus・private artifacts・runtimeと、新contextDir・development runDirを**別形式のまま保持** | 合意や証拠は再利用できるが、入力形式・所有権・保存先の拘束が違う。JSONのコピーや名前変更で移行しない。詳細は保存互換性の表（旧6） |
| 設計・計画資料 | 新 `docs/design/`・`docs/workflow-refinement/` を設計の入口として**引き継ぐ**。旧のcommit済みruntime設計と未追跡移管メモも**保持** | 継続方針と検討案は[設計の入口](../design/README.md)で区別する。旧 `workflows/runtime-orchestration-*.md` は旧方式の判断根拠。ローカルメモをcommit済み資料に見せない（旧8） |
| 試行商品・固定データ・E2E・撮影・実測記録 | `trial/` と [evidence](../../trial/evidence/README.md)、[設計の保存記録](../design/archive/README.md) を**試行用に分離して保持** | 4商品のアプリ、検索・並び順、localStorage、画像・動画は運用ハーネス自体の仕様ではない。現行check・setup・captureはtrialへ結合しており、先に取り除くと検証が壊れる。分離の実装と検証入口変更は別Issueで判断 |
| 依存・品質検査・CI | 新の固定依存・制御テストを**引継ぎ候補**とし、旧lockfile・設定・テストも**保持** | 旧のSDK・corpus検証・skills検証・knip・textlintと新のPlaywright・Biome・TS検査を単純に和集合にしない。残す責任に対応する検証を選ぶ。現在の検証定義は今回変更しない（旧7、[package.json](../../package.json)、[CI](../../.github/workflows/ci.yml)） |

## scoping・implementとの実際の対応

旧の停止・再開の保証は、対応するruntimeとhookが契約どおりに動く条件での実装上の保証であり、ホストへの登録確認の代わりにはならない。新のスキルに書かれた担当者の行動と、CLIが機械的に止める条件も分けて読む。

| 入口と責任 | 旧の出力・停止・戻り先 | 新の出力・停止・戻り先と差分 |
| --- | --- | --- |
| 要求調査：依頼と対象repo | Researchは起動時snapshotに対する根拠を静的検証・独立監査し、報告を確定。未知は未知として残し、監査済みの人の判断が必要なら待機する。Thinkの事実不足はResearchへ戻る（旧1・旧2） | scoping担当者が現行資産・出典・十分性を調べ、note、assess、gate、archiveで保存。discovery CLIはモデルを起動せず評価内容の真実性を判定しない。事実不足は調査へ、意図・範囲は人へ戻す。独立評価は必要な場面で使い、旧の全報告への必須監査ではない |
| 要求・設計と人の合意：根拠と未決定事項 | ThinkはPlanまたは独立評価済みの質問を出力。回答は所有者に束縛して元入力へ記録し、同一の実行・snapshot・予算で再開する。回答なしでは先へ進まず、回答だけでIssue/Ship権限を増やさない（旧2） | scopingはチャットで回答を待ち、決定の正本と適用範囲・合意者をIssue等へ残す。noteで旧評価を無効にして再評価する。質問ごとの専用記録は作らず、discovery gateは保存済み評価のみを見る。質問表示・回答受領・実装起動をシステム全体で強制する仕組みではない |
| Issue公開：要求・範囲の合意 | 明示Issue権限とready Think Planから読みやすい本文・同一のcanonical JSON Planを作る。静的検証と独立忠実性評価を経てcreate/update。Plan変更はThinkへ、GitHub不明結果はIssue側に保存して停止する（旧2） | scoping担当者が既存ghで重複調査、本文作成・公開・再読し、参照をnoteへ残す。公開範囲は依頼に従い、案だけならrepo内文書で終了。discoveryからの公開やimplement起動はない。旧の公開intent・pending write・忠実性評価の機械的な保証は新CLIにない。不明結果の照合・重複防止は担当者が担う |
| 実装：選択した公開Issue | BuildはIssueを開始時に一度読み、唯一の `## Plan` のJSONを実装正本として固定。全範囲を1 actorが実装・自己評価。契約外判断のhandoffを独立評価し、事実はResearch、設計はThinkへ。Plan案が変われば旧Buildを停止したまま、別のIssue更新許可と新Buildが必要（旧2・旧3） | implementはOPENなIssueのtitle/body等の全文を取得し、cleanなcommitted HEADから隔離worktreeを作る。初回実装→correctionへ進み、途中の要求変化は停止する。範囲・権限判断は `needs_human` で人・scopingへ返す。新側はJSON Plan専用のparserや、旧の永続化した子フローへの自動往復を持たない |
| 検証と独立評価：実装済み対象 | Build/Code共通executorがshell testと独立した意味の評価を実行し、対象source・dispatchへ束縛。失敗は実装actorへ戻し再検証。確定した結果でBuildはcommit、CodeはGit公開操作なしで終了（旧3） | ホストが共通check・必要な撮影を実行し、別のread-only actorが要求全文・コード・テスト・文書・証拠を評価。失敗は修正→check→評価へ戻る。回数・時間・不正応答・対象変化・環境障害で停止する。`ready_for_human_review` はローカルの引き渡し判定であり、人の承認ではない（[制御手順](../../scripts/README.md#結果と再実行)） |
| PR公開：検証済み変更と公開権限 | 明示Build呼び出しに含まれるShip許可でpush・draft PRを行う（公開除外指定を尊重）。Issue公開とは別の権限。保留したGit操作・PRを照合して再開し、要求された画像はseal済みbytesと照合（旧1・旧3） | implement依頼に含まれる公開範囲でcommit・既存Git認証によるpush・Appによる通常PR作成・既存ghによる添付・CI確認。`--no-publish` はcommitも省略する。公開不明は記録を保持して担当者が照合し、自動再開はしない。表示・再生・配置は公開担当へ戻す（[公開手順](../../scripts/README.md#prの公開)） |
| 人のレビュー・承認：最新PRと証拠 | Ship完了やdraft PRは人の承認・マージの証拠ではない。旧cleanupもGitHubのMERGEDと検証済みShip receiptを別に確認する（旧3・旧4） | 新は全変更で人のレビュー・承認を要求し、最新CI・会話解消等を実際のGitHub設定で確認する。指摘は内容不足なら実装、説明・添付なら公開担当、範囲変更ならscopingへ戻す。自動承認・マージは行わない（[方針](../../DEVELOPMENT.md#ciとmain保護)） |

旧の公開Issue・Planを新へ渡す際は、既存の本文・合意・出典・未完了事項を残し、今回実装する全文と検証条件を担当者が照合する。旧形式であることを理由に要求を削ったり、新gate成功を旧の監査済みPlanと同一視したりしない。新側の文書のみのIssueも同じ実装・検証・評価の入口で扱うが、必要がなければコード・テスト・撮影を追加しない。

## 実行先・ホスト・公開主体

| 論点 | 確認した定義と移行前の不足 |
| --- | --- |
| 対象repo | 旧runtimeはGit worktreeと対象の `.codex/OUTCOME.md` を要求し、特定owner/repoの固定allowlistは見当たらない。Codeはcommit前のrepoも扱う。新discoveryはGit管理ディレクトリへ保存庫を束縛するがrepo名を固定しない。一方developmentとpublishは `thkt/dotagents-workflow-trial` 専用で、公開先main・App・installation・repository IDも固定。`--repo` は汎用化スイッチではなくcheckout指定（旧5・旧6、[development](../../scripts/development.ts)、[publish](../../scripts/publish.ts)） |
| スキル検出・CLI登録 | 旧は6スキルのyaml、11個のpackage bin、hooks.jsonを定義するが、インストール・PATH解決・イベント登録済みとは証明しない。`.skill-lock.json` も登録の実測ではない。新は追跡された `.agents/skills/scoping`・`implement` の相対symlinkがそれぞれ `../../skills/` の正本へ解決し、root packageにbinはない。新旧の同時検出・優先順位・別repoからの検出は未検証。登録方式と旧コマンドを残す期間を決める（旧1・旧5・旧7、[新の入口](../../README.md#要求整理とissue作成)） |
| hookとの結合 | 旧hookは先頭の明示 `$research` 等、cwd・session_id、Bash形式のイベントとコマンド束縛を使う。post-editは旧導入先のツール・設定で編集ファイルを自動修正する。新repoのスキルはhookを追加しない。現在のホストのtool名やイベントで旧hookが発火するか、切替後のファイルへ旧整形が作用しないかは登録担当者の確認が必要（旧5） |
| 依存とOS | 旧はBun 1.4.0、lockされたCodex SDKとインストール済みcodex（PATHまたはCODEX_CLI_PATH）、Git、gh、SQLiteを使い、shell検証は `/bin/zsh` に依存する。新はBun 1.4.2、固定依存、外部codex CLI、Git、gh、Playwright/Chromium、macOS/Linuxのプロセスグループを使用。旧も新もモデルはコード上Astra/high。新公開はmacOS login Keychainと `/usr/bin/security` に依存する。LinuxのCI成功は公開経路の移植性の証拠ではない（旧3・旧6・旧7、[actor](../../scripts/codex-actor.ts)、[セットアップ](../../README.md#セットアップと検証)） |
| 認証と公開主体 | 旧の閉じたgh呼び出しはIssue公開とBuild Shipの権限を区別するが、実際のGitHub主体はホスト認証に依存する。旧SDK用private homeは既存のauth.jsonを使い、shell検証ではGitHub token環境とgh設定を隔離する。新scopingのIssue公開と媒体添付は既存gh、pushはGitの認証設定、PR作成は限定tokenを発行・失効する固定App。これらをすべてApp公開と書かない。実際のログイン主体・権限・鍵の有効性・失効失敗時の対応を公開担当が確認する（旧6、[publish](../../scripts/publish.ts)、[公開手順](../../scripts/README.md#prへの画像動画の添付)） |
| 作業と信頼する制御コード | 旧はsnapshot・repository isolation・private保存領域を使う。新developmentは外部runDir内にworktreeを作り、制御コードと設定をactorの編集対象外から実行する。新actorの `--ignore-user-config` やsandbox指定だけで、ホストの秘密・全設定・同一ユーザーの任意改変まで隔離できるとは扱わない。App鍵・書き込みtokenをactorへ渡さない運用を保つ（旧3・旧6、[制御手順](../../scripts/README.md)） |

推論として、ディレクトリ名を `.agents` に変えるだけでは、対象repoの固定値、hookのイベント形式、認証経路、検証のtrial依存は解消しない。正規運用をこの試行repoだけに限るか、他repoでも使うかは未決定であり、後者ならコード・設定・検証変更を別Issueで合意する必要がある。

## 保存データ・実行状態の互換性

| 資産 | 旧から新への扱い（提案）・保持理由 |
| --- | --- |
| 共有する調査 | 旧 `research/records/<research_id>.json` がcanonical原本、`research/reports/` が生成Markdown。独立監査・公開安全性監査と対の整合を検証し、Knowledgeは再構築可能な索引。旧基準commitのrecords/reportsに追跡されているのは `.gitkeep` のみであり、報告が保存済みとは主張しない。新はcontextDirの `research/` にsession・revision付きMarkdownを保存し、Issue/PR・evidenceで共有する。自動corpus検証・公開安全性監査・Knowledge検索はない。旧の対と来歴を保持し、新には選んだ根拠と適用条件への参照を渡す。単なるコピーを再監査済みとしない（旧2・旧6、[新の保存手順](../../skills/scoping/references/session.md)） |
| 旧private artifacts | 既定は実行先repoの `.codex/workflow-artifacts/`、CODEX_FLOW_ARTIFACT_DIR指定時はrepo実体パスのhashで区別する。Research/Think/Issueの私的報告と索引を保持する。cleanupはこのoverrideに従わずprimary worktreeの `.codex/workflow-artifacts/cleanup` を所有するため、recovery refs・復元用stagingも別に確認する。snapshot・actor payload・検証・公開証拠はruntime等の実保存先と合わせて保持する。repo内private保存にはignore等の制約があり、Researchの公開排他用 `/tmp/codex-research-publication-locks-<repo実体パスのSHA-256>` も状態確認の対象とする。新の公開evidenceへ全内容を移さない（旧6） |
| 旧runtimeと進行中の実行 | 既定はOS一時領域の `codex-flow-runtime-<uid>/<run-idのhash>/`、CODEX_FLOW_RUNTIME_DIRで変更可。入力・intent・状態・質問回答・子実行・retry予算・pending publication・ownership.sqliteと関連ファイルを扱う。新には対応するimport/resumeがない。旧版と元入力・対象repoの束縛を保持し、旧正本の再開条件で解決する。Build/Codeのcancel、cleanupのprepare/run/resume等は各入口の範囲で使う。Research/Think/Issueに共通cancelはなく、一括取消は手順化しない。一時領域も「消してよいキャッシュ」と一括扱いしない（旧2・旧3・旧6） |
| 新scopingのcontextDir | `repository.txt` はGit共通管理ディレクトリに束縛。`work/<task>/state.json`、lock、一時保存、`research/`を保持。同じrepoのworktreeで共有できるが別cloneは別保存先。保存されたrepo・contextDirの絶対パスにも依存し、移転は自動修復されない。questionフィールドの旧セッションは拒否するため、原本を残して新taskへ必要な参照を渡し再評価する。旧workflow JSONも読み替えない（[discovery](../../scripts/discovery.ts)、[保存・再開の正本](../../skills/scoping/references/session.md)） |
| 新implement/correctionのrunDir | development既定はユーザーデータ領域の `.local/share/dotagents/development/<Git共通管理ディレクトリのhash>/<Issue番号>/`。要求・隔離checkout・初回結果・verification設定/state/log・PR/CI記録を保持。correctionは設定したrunDirに回数・累積時間・active・対象hashを保存する。既存development runDirの再利用、残存lock/activeの自動解除、上限リセットは行わない。CLIに移行・自動復旧・cleanup入口はない（[development](../../scripts/development.ts)、[input](../../scripts/input.ts)、[停止後の正本](../../scripts/README.md#結果と再実行)） |
| Git・未コミット作業と試行証拠 | 両checkoutのHEAD、branches、worktree対応、staged/unstaged/untracked/ignoredファイル、旧の未追跡docs、runtime外にある保存先も対象を確認して保持する。新 `trial/evidence/` の媒体と対象版・来歴も保持し、`trial/artifacts/` の再生成で代替しない。`trial/evidence/generated/` はホストが置き換える領域なので、移行比較用の既存媒体をそのまま上書きしてはいけない。商品localStorageはorigin・browser profile側の試行状態であり、repoの移動では移送されない（[試行の保存区分](../../DEVELOPMENT.md#実装とテストの整理)、[商品仕様](../../README.md#提供する機能)） |

同じ `state.json` という名前でも契約は異なる。旧runtimeのSQLite所有権、新discoveryの保存lock、新correctionの予約・対象hashは互換ではない。保存先の統合、state編集、古い成功判定のコピーを移行手順には含めない。

## 事前確認から受入・復帰まで

以下は**今後の採用合意後に使う判断順序**。今回は実行しない。各段階の担当者が確認結果と未解決事項を移行Issue/PRへ残し、非公開の復元記録へは必要な実パス・登録先・保存先を記録する。公開文書には相対パス・対象commit・確認した結論だけを載せる。

| 段階 | 担当者が揃えるもの・進める条件 | 停止と戻り先 |
| --- | --- | --- |
| 1. 事前確認 | 移行担当が両HEADと差分を再取得し、本書との差を確認。ホスト担当が実際のスキル検出元、binの解決先、hook登録先とイベント、対象repo、認証の主体、全保存先・進行中のrun/worktreeを特定する。公開先repoと保護条件も確認 | 不明な登録・所有者・進行中の書き込み・公開結果があれば切替停止。事実は調査、運用範囲や権限は依頼者の判断へ戻す |
| 2. 保全と準備 | 新規起動を止める範囲を合意し、既存runは旧版で完了・取消・保留を確定する。変更・未追跡docs・ignoredデータ・runtime・証拠・Git情報・登録設定を復元できるよう保持。稼働中SQLiteやGitの部分コピーを整合したバックアップと見なさず、書き込み停止と復元確認を行う。旧版のコード・lockfile・必要な実行依存も保管 | snapshotやdiffだけでは未追跡・ignored・外部保存庫の保全にならない。所有不明や復元不能なら元環境を保持して準備へ戻す。秘密は管理された既存保管手段を使い、checkoutへ複製しない |
| 3. 候補環境での確認 | 旧の稼働環境とは別に新の信頼するcheckoutを用意する方針を選ぶ。対象repoの固定制約、共通checkのtrial依存、認証・スキル表示・相対参照、CLIの停止条件を確認。残作業の実装・検証・採用合意が揃ってから切替対象と戻し方を確定 | 他repoへ渡せない、旧で必要だった保証の代替が未合意、既存状態を要求する実行を再開できないなら切替しない。別Issueの実装または対象範囲の判断へ戻す |
| 4. 切替 | ホスト登録担当が、承認された登録先と入口だけを候補版へ向ける。旧checkout・状態・証拠・復帰用登録記録を残し、同じtask/repoへの新旧同時書き込みを避ける。新taskへは合意・根拠・未解決事項の参照を渡し、新基準で評価する | 登録方式が未確定の現時点では実行コマンドを指定できない。新旧の意図しない重複検出・hook作用、違うrepo・主体、保存先の衝突を検出したら新規起動を停止し復帰判断へ |
| 5. 受入確認 | 運用担当が下記受入観点を承認済み対象で確認。検証担当は既存check結果を、独立評価担当は要求・文書・保証の不足を、公開担当は対象・主体・PRと必要な媒体表示を、人は最新差分と未確認範囲を確認する | check成功だけで正規運用可にしない。実装不足は修正・再検証、登録/認証はホスト担当、範囲変更は要求整理へ。受入失敗は旧資産を削除せず停止または復帰 |
| 6. 受入後の整理 | 安定運用と証拠の参照・復元可能性を確認した後、旧を残す期間、試行資産の分離先、整理対象を別途合意する | 受入完了を旧削除やcleanup実行の許可へ読み替えない。未完了実行・未保存の証拠・対応しないreceiptが残れば整理停止 |

### 受入で確認すること

- **入口**：許可したrepo・ホストで意図した版のスキルとCLIだけを呼び、相対参照が解決する。旧binを残す場合は解決先が旧版であることと、旧hookが新操作へ誤作用しないことを確認する。別repo対応を採用するなら、そのrepoでも確認する。
- **要求の引き継ぎ**：scopingで事実不足、回答待ち、合意、Issue反映と再読まで確認する。案のみの場合は公開しない。保存済みgate成功だけで合意と見なさない。文書のみのIssueも対象に含める。
- **実装・停止**：合意済みIssueで隔離、共通check、独立評価、必要な修正と再評価を確認する。要求変化、dirty入力、既存run、lock/active、上限や環境障害で成功扱いしないことは既存制御テストと対象版の結果を照合する。稼働中の本番状態を壊して試さない。
- **公開・人への引き渡し**：公開を許可した試行だけで、Issue/PR/push/添付の主体、対象head/base、最新CI、必要な表示と人の承認の残作業を確認する。`--no-publish` のローカル成功を公開経路の証拠にはしない。旧draft PRと新通常PRの違いも採用時に判断する。
- **保持と復帰**：原本、未コミット作業、未追跡資料、旧の停止状態と証拠を読めることを確認する。隔離した復元確認で元の版・登録先・保存先の対応を確かめ、runtimeの互換変換ができたとは扱わない。

### 元へ戻す条件と方法

必要なrepoで起動しない、誤った公開主体・対象へ接続する、必要な旧保証が欠ける、保存先の衝突や証拠欠落がある、合意済み受入を満たさない場合は、新規実行を止めて復帰を判断する。新側の作業・媒体・消費予算・公開結果も保持する。新CLIのSIGINT/SIGTERMによる停止と、強制終了後の残存プロセスの照合は[停止後の正本](../../scripts/README.md#結果と再実行)に従い、lock削除で停止済みと見なさない。

登録担当が事前に記録した旧スキル・bin・hookの参照先と設定へ戻し、保管した旧版・依存と元のrepo・保存先の対応を確認する。旧checkoutを元の場所に保持する案を優先する理由は、絶対パスや実体パスhashを含む状態を移し替えず復帰できる余地を残すためである。ただし復帰成功は実確認が必要。登録方式が不明なまま `ln`、インストール、hook解除等のコマンドを捏造しない。登録の復元手順をホスト担当が具体化するまでは切替不可とする。

旧の途中実行は旧 `workflows/README.md` の元入力・同一task・予算・所有権・公開照合に従って復帰可否を判断する。新で生じた変更を旧stateへ流し込まず、必要な変更は新たな合意済み作業として引き継ぐ。すでに公開されたIssue・PR・pushはファイルの復元では取り消せない。GitHub上の実状態とpending記録を照合し、修正・取消が必要ならその権限を確認する。不明な公開を別名taskで再送しない。

## 移行前に残る決定と実装

| 未解決事項 | 決める人・必要な成果 |
| --- | --- |
| 正規運用のrepo範囲と新旧保証の採否 | 依頼者・運用担当。試行repo限定か汎用化か、旧Code/cleanup、監査・質問待機・公開intent・再開保証を残す範囲を合意する |
| 実ホストの登録方法と復帰手順 | ホスト登録担当。検出元・PATH・hook設定の現状を特定し、候補への切替と旧へ戻す具体的な設定差分をレビュー可能にする。現repoに汎用installerはない |
| 公開主体とOS対応 | 公開担当。Issue・push・PR・添付ごとの主体・権限、App固定値とmacOS依存の扱い、GitHub保護を確認。鍵・制御コードの変更は別Issueの範囲とする |
| 保存先・途中実行・互換性 | 実行担当。実際のcontextDir/runtime/artifacts/runDirを特定し、旧版で解決する実行と新taskへ参照を渡す作業を分ける。新にimport・自動復旧・lock解除・旧receipt対応cleanupはない。必要なら仕様から合意する |
| trialと正規ハーネスの検証分離 | 検証担当。現行のcheck・setup:e2e・captureとtrialの結合を保ったまま保存し、分離後の検証範囲と既存テストの引継ぎを別Issueで定める。検出範囲を黙って減らさない |

これらが未決定であることは本書作成の不足を推測で埋める理由にはならない。実際の移行を止める条件として残す。

## 本書の検証と出典

本変更はこのMarkdownと[設計の入口](../design/README.md)のみ。現行コード・設定・入口との照合、相対リンクと読む順序、責任の抜け・旧保証の過大な引継ぎ・保全と復帰の不足を確認する。独立評価は執筆者と分け、指摘で本文が変われば関係箇所を再照合する。共通検証は既存の `bun run check` をホストが実行する。文言一致テスト・専用スキーマは追加しない。画面変更や新規媒体の要求はないため、撮影定義の追加・変更、画像・動画の再生成は不要。静的照合や過去の[検証記録](../../trial/evidence/README.md)を、今回のホストcheck・実移行・別環境での成功として報告しない。

### 旧側の出典

次のパスはすべて上記の旧commit基準。旧checkoutの同じパスを読み、版が違えば差分を再確認する。旧ローカルdocsだけは冒頭の確認日・hashによる。

| 出典 | 責任と主な確認元（旧checkout相対） |
| --- | --- |
| 旧1 | 目的・スキル：`AGENTS.md`、`.codex/OUTCOME.md`、`skills/{research,think,issue,build,code,cleanup}/SKILL.md` と各 `agents/openai.yaml`、`skills/code/references/`、`.ja/` |
| 旧2 | 調査・設計・公開・差し戻し：`workflows/README.md`、`workflows/research/{pipeline,investigation,public-safety,state}.ts`、`workflows/think/{pipeline,state}.ts`、`workflows/issue/{pipeline,lifecycle,github,state,public-contract}.ts`、`workflows/plan/{contracts,validation}.ts`、`workflows/runtime/{clarification,stage-return}.ts` |
| 旧3 | 実装・検証・Ship：`workflows/build/{runner,manifest,git-actions,github,artifact-verification,pr-body,screenshots}.ts`、`workflows/code/{runner,manifest}.ts`、`workflows/execution/{engine,controller,repository-isolation,actor-receipt,source-seal,shell-verification}.ts` |
| 旧4 | 整理・復元：`skills/cleanup/SKILL.md`、`workflows/cleanup/{runner,controller,inventory,evidence,recovery,state}.ts` |
| 旧5 | hook・起動条件：`hooks/{hooks.json,workflow-enforcer.ts,post-edit.ts}`、`workflows/runtime/{cli,invocation}.ts`、`workflows/shared/project-outcome.ts` |
| 旧6 | 保存・ホスト・認証：`workflows/runtime/{environment,storage,ownership}.ts`、`workflows/shared/{codex,codex-home,github}.ts`、`workflows/research/{corpus,knowledge,verify}.ts`、`research/README.md`、`.gitignore` |
| 旧7 | 登録定義・依存・検証：`package.json`、`bun.lock`、`.skill-lock.json`、`.oxlintrc.json`、`.oxfmtrc.json`、`.textlintrc.json`、`tsconfig.json`、`knip.json`、`skills/validate.ts`、`skills/tests/`、`workflows/tests/`（移植性・hook・状態保持・公開・cleanup等の検証定義） |
| 旧8 | 旧設計とローカル資料：commit済み `workflows/runtime-orchestration-plan.md`、`workflows/runtime-orchestration-research.md`。未追跡 `docs/design/README.md` は移管先の案内のみ |

新側の重要な根拠は各節の相対リンクに示した。[discoveryの検証](../../scripts/tests/discovery.test.ts)、[developmentの検証](../../scripts/tests/development.test.ts)、[correctionの検証](../../scripts/tests/correction.test.ts)、[公開の検証](../../scripts/tests/publish.test.ts)、[テスト完了判定](../../scripts/test.ts)は、保存・停止・対象変化・模擬公開の確認資産として再利用する。実ホストの登録・認証・移行復元や実モデルの判断品質まで検証済みとは扱わない。
