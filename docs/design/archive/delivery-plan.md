# 実現・評価・移行の計画案

> 保存された設計・試行記録です。本文の進捗・提案・実行上限は記録当時のものです。現在の操作や権限には適用せず、[設計の入口](../README.md)から現行手順を確認してください。

## 目的と現在地

チームが要求・進行・成果・根拠を共有し、品質を確認しながら少ない介入で開発を継続できる構成を実現する。2026-09-10時点で、独立した公開試行リポジトリのCI・マージ制御・AppによるPR作成と、商品一覧・検索を題材にした初回試行が完了した。Issue #1・#9・#10は完了し、PR #12のマージ後main CIも成功した。初回の進行は親タスクが担当しており、自律ハーネスや費用対効果の評価は未完了である。

設計の入口としてこの文書を使う。目的は[OUTCOME改訂案](../OUTCOME-draft.md)、判断原則は[開発方針案](../development-policy-draft.md)、用語は[概念と責任範囲](../architecture-concepts.md)を参照する。詳細は[情報・合意・証拠](../information-and-evidence-design.md)、[実行構成](execution-design.md)、[能力調査](capability-assessment.md)に分け、ここへ複製しない。

## 調査から要求合意までの試行

[試行計画](discovery-trial-plan.md)で、曖昧な依頼から合意済みIssueへ進む仮の動き、架空の課題、評価観点を定める。計画作成までの範囲であり、実験用の追加LLM実行や商品実装は未開始。既存の実装・修正CLIへ渡す前の運用を確かめ、不足が確認された箇所だけ整備する。

## 実現する順序

以下の段階は計画であり、段階2の全条件を網羅的に実証したという意味ではない。本文後半の準備時点の記述・経過は履歴として残す。現在の責任配置は[初回試行後の自動化と判断の配置](execution-design.md#初回試行後の自動化と判断の配置)を参照する。

### 次に確かめる最小の範囲

具体的な要求・完了条件・失敗ケースは[Issue #13](https://github.com/thkt/dotagents-workflow-trial/issues/13)へ公開した。2026-09-10に追加試行をAstra/high・修正2回・独立評価2回・累計20分で合意し、実装と検証を開始した。準備時の記録は[Issue案](trial-correction-issue-draft.md)を参照する。

初回に親タスクが担った「失敗を渡す→修正する→再検証・独立評価する」の接続を、対象と実行上限を保って進められるかを次の試行候補とする。広い中断・並行制御を一度に作らず、通常の差し戻し経路から始める。

- 入力は合意したIssueと対象成果物、既存の検証・評価結果。要求全文を新しい編集可能な正本へ複製しない。
- 必須検証の失敗・評価の未達を成功扱いせず、具体的な根拠を作業担当へ渡す。修正によって対象が変われば、その対象の検証と必要な再評価を行う。
- 文書だけの変更も対象変更として記録する。機械的な一致確認と、変更の影響に応じた評価範囲の判断を区別する。
- 実行上限内の通常修正は人を呼ばず進め、上限・確認不能では未達を残して停止する。人の承認前にマージしない。
- 既存の実行環境で満たせる制御を先に確認し、不足が再現した箇所だけを小さく実装する。常駐管理エージェント、独自の巨大な状態機械、毎工程の新契約を前提にしない。

実装前に別Issueで対象・完了条件・失敗ケース・公開範囲を具体化する。まずモデルなしで進行判定を確認し、実モデルでの修正・再評価は新たな実行回数と時間上限を合意してから行う。初回の実装・修正3回、独立評価3回は消化済みであり、残り時間だけを追加実行の許可に使わない。今回の更新は設計反映で、追加実装・モデル実験の開始ではない。

以下は開発上の段階であり、完成後に毎回通る工程ではない。各段階は人がレビューできるPRへ分割する。後段の自動化のために、前段の検証・承認を弱めない。

| 段階 | 届ける成果 | 次へ進む条件 |
| --- | --- | --- |
| 1. 導入条件と評価条件を揃える | 対象の環境、担当・承認権限、必要な証拠、比較課題と計測方法を決める。現行運用と分けた試行場所を用意する。 | 新構成で評価する範囲、実行上限、実行・公開権限、比較方法が明確。現行を変更せず試行できる。 |
| 2. 一つの変更を最後まで届ける | Issueの合意から実装、静的・動作検証、独立した評価、PRでの説明、人のレビューまでをつなぐ。 | 完了条件と証拠が対応し、失敗・未検証・対象の不一致で成功できない。別メンバーがIssue/PRから判断できる。 |
| 3. 変更・中断・並行作業に対応する | 要求変更、修正差し戻し、担当交代、外部操作の結果照合を実現する。 | 影響に応じて再評価でき、他者の作業を上書きせず再開できる。応答不明の操作が重複しない。 |
| 4. 品質・文書・環境を継続維持する | Actionsによる文書整備、必要なプレビュー・操作証拠、環境セットアップの確認をつなぐ。 | 更新漏れ・古い証拠・再起動漏れを検出し、生成処理が循環しない。必要な文書が成果とともに届く。 |
| 5. 合意済み資産でレビュー負担を減らす | 実在する資産について確認済み範囲と残る観点を示し、適切な証拠を提示する。 | 人のレビューで見落としと負担を評価できる。省略候補は人のレビューも併用して判定の差を測る。 |
| 6. 評価した範囲で移行する | 結果に基づき、採用する構成・適用範囲・切り戻し方法を決める。 | 品質とチームの負担を比較した根拠があり、未評価の条件が明示される。移行範囲について合意がある。 |

段階2には基本のCIとマージ制御を含む。段階4まで検証をローカルだけに置くという意味ではない。各段階の実装に必要なテスト・文書は、その段階で揃える。段階4は維持作業の自動化を拡張する。

合意済み資産は初期から要求定義・実装・検証・レビューで参照する。Issueでは共通条件の参照と今回の差分によって重複記載を減らす。段階5では要求定義とレビュー双方の負担削減、および省略判定を測る。人のレビュー省略の本番導入は、具体的な対象・条件・権限を合意した場合に限る。省略経路が成立しなくても、基本フローとレビュー負担削減の評価は継続できる。自動マージはこの計画から暗黙に許可しない。

## 最初の実装を切る単位

### 試行場所と初回課題の具体案

試行場所は独立したGitHubリポジトリ `thkt/dotagents-workflow-trial`、公開範囲はPublicとする構成で合意した。公開可能な試行コードと架空データだけを扱い、現行リポジトリの共有設定を変更せずにActionsやマージ制御を評価する。その後の作成承認を受け、2026-09-09に公開リポジトリを空の状態で作成した。初期コード・CI・保護設定の導入と実験は未実施。

初回課題は「小さな一覧画面に、指定した項目の検索を追加する」を案とする。実在する利用先が決まるまでは、機密情報のない試行用データを使う。既存の適切な部品や利用パターンがあれば再利用し、存在しない合意を前提にしない。試行用資産を作る場合は、その評価・合意を検索追加の受け入れと分ける。

この課題で、Issueの目的・固有条件・共通条件への参照、ロジックと画面の接続、E2E、スクリーンショットによる説明、文書の更新、人のレビューまでを確認する。画面の構成や基準が未合意なら、人の確認対象として残す。初回から動画・音声・外部プレビューをすべて必須にはせず、証拠として必要かを判断する。

最初は正常な一つの変更と、検証失敗・古い証拠・文書更新漏れを含む対応ケースを確認する。同じ課題で要求変更・中断・レビュー省略まで一度に評価しない。比較実験の反復数と実行上限は別途確定し、試行の成功を費用対効果の結論にしない。

段階1で採用先を決めた後、少なくとも次の成果を分けてレビューできるようにする。Issue番号やbranchは実装準備時に決める。

- 新しい環境でも実行できる共通の検証定義と、必要な結果が揃わなければ通らないCI。
- Issueの対象・合意と、変更・検証・評価の対応を確認できる最小の実行経路。
- 結果をPRで説明し、人の承認をマージ条件へ結びつける設定と運用。

これは固定の3PRではない。依存する変更は、単体で安全に取り込める順序に分ける。設定の有効化で既存運用を止める可能性があるため、チェック発行と対象権限を確認してから保護を有効にする。

### 初回試行の内容と上限案

初期内容は、方針と要求の参照先、検索追加前の小さな商品一覧、架空の商品データ、セットアップ手順、共通の検証定義、Actionsの検証設定を基本案とする。既存のハーネス一式をコピーしない。初期資産の評価・合意と、その資産を利用した検索追加は区別する。

検索追加Issueの条件案は、商品名・商品コードへの部分一致、前後空白の除去、英字の大小文字を区別しない検索、空入力時の全件表示、該当なしの表示、入力解除での復帰とする。サーバー通信・保存済み検索・認証・本番配布は初回の対象外とする。これらは試行用要求案であり、実装前に確定する。

初回の成功確認に加え、テスト失敗、検証後の対象変更、必要な文書の更新漏れを試行環境で与え、成功扱いせず修正・再確認へ戻るか確かめる。制御の障害ケースはまずモデルなしで確認し、実モデルの修正確認とは分ける。

初回試行の上限はAstra/highで実装・修正最大3回、独立評価最大3回、モデル実行の累計待ち時間最大60分とすることでユーザーと合意した。今回の合意は上限の確定であり、実装・実験開始の判断は別途行う。初回試行は比較実験ではなく、料金の上限も意味しない。実測usageを保持し、上限に達したら未達事項を残して停止する。CIの実行上限と具体的な使用条件はworkflow設計時に決める。

PR作成主体は人の承認者と分け、自動化用の別主体でPRを作成し、thktが人としてレビュー・承認する構成で合意した。GitHubでは作成者が自分のPRを承認できないためである。実際の主体・必要な権限を決めてから、設定と受け入れを検証する。アカウントの新設や招待はまだ行わない。[GitHub公式：Reviewing proposed changes](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request)

### 自動化用の主体と権限の具体案

試行専用のGitHub Appを新設する方針でユーザーと合意した。ローカルからPRを作成する初期構成では、試行リポジトリだけにインストールしたAppのinstallation access tokenを使う案とする。ユーザーに代わって操作するuser access tokenとは区別し、PR作成主体がthktにならないことを実際のPRで確認する。Appの登録・試行先限定のインストールは承認済み。2026-09-09に登録済みのAppを確認し、試行リポジトリだけにインストールした。鍵の発行・取得状態は下記「CLIによる公開操作と次の受け入れ確認」に記録する。Appとしての読み取り確認は成功済み。PR作成・人の承認・CIの検証は未実施。[公式：Authenticating as a GitHub App installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)

| 権限 | 初期案での用途 |
| --- | --- |
| Contents: write | 試行用branchへの変更の送信。 |
| Pull requests: write | PRの作成・説明更新。 |
| Issues: write | 許可されたIssue作成と進行・結果の記録。 |
| Metadata: read | リポジトリの識別。 |

APIごとの必要権限を導入時に確認する。Administration、Workflows、Checks・Statusesの書き込み、rulesetのbypassは初期案で付与しない。CI・保護設定の初期整備は、権限を持つ人による別の操作として扱う。Contentsの書き込みはbranch限定の権限ではないため、mainへの制限をruleset等と組み合わせて実際に確認する。トークンだけでPR作成とマージの全操作を分離できるとは主張しない。[公式：Choosing permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)

Appの鍵と書き込みtokenは公開処理側で管理し、実装者・レビュアーが実行する未検証のコードへ渡さない。検証処理の資格情報とは分け、合意した範囲の差分・説明を公開処理へ渡す。資格情報をチャット、Issue、PR、ログに貼る運用にしない。保管・受け渡しの具体的な方法は利用する実行環境で確定する。

比較候補はActions内の`GITHUB_TOKEN`である。同じリポジトリ内のworkflowから投稿する構成なら、独自Appの管理を省ける可能性がある。一方、ローカルでの公開処理からそのまま利用する前提にはできず、自動更新後のCI起動条件も確認が必要になる。Appのためだけに常駐サーバーを設ける案は初期構成に含めない。[公式：About authentication to GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github)

新設するAppの合意済み登録内容は以下とする。2026-09-09に登録・試行先限定のインストールを確認した。App IDは `4881432`、Installation IDは `160237952`。[インストール設定](https://github.com/settings/installations/160237952)で対象が `thkt/dotagents-workflow-trial` の1件だけであることと、下記の権限を確認済み。Webhookとインストール時のOAuthユーザー認可は無効。鍵の発行・取得状態は下記「CLIによる公開操作と次の受け入れ確認」に記録する。Appとしての読み取り確認は成功済み。PR作成・人の承認・CIの検証は未実施。

| 項目 | 合意済み登録内容 |
| --- | --- |
| 所有者 | thkt |
| App名 | thkt-dotagents-workflow-trial（登録済み） |
| Description | Automation identity for the dotagents workflow trial. |
| Homepage URL | `https://github.com/thkt/dotagents-workflow-trial` |
| インストール可能なアカウント | Only on this account |
| インストール対象 | Only select repositoriesで `dotagents-workflow-trial` のみ |
| Webhook | 無効。初回はAPI操作の認証主体として使い、受信サーバーを設けない。 |
| ユーザー認証 | OAuth callbackやインストール時のユーザー認可は使わない。 |
| 権限 | 上記のContents・Pull requests・Issuesのwrite、Metadataのread。 |

リポジトリはPublic、Appは所有アカウントだけがインストールできる設定とする。この二つの公開範囲は別である。認証用途だけならWebhookを無効にできる。[公式：Registering a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)、[Using webhooks](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps)

導入時は、試行リポジトリと初期Issueを用意し、Appを登録して対象リポジトリだけにインストールする。鍵は公開処理からのみ利用できる保管先を確定してから発行・保管し、読み取り確認、試行branch・PR作成、thktによる承認の順に確認する。App ID等の非秘密情報と鍵・tokenを区別して扱う。

### CLIによる公開操作と次の受け入れ確認

GitHubの操作手段は既存の `gh` とGitを使い、GitHub Appは操作主体・権限を分けるために使う。専用のGitHub操作SDKや常駐サーバーは、この目的だけでは導入しない。ローカルcheckoutの管理に `ghq` を使うかは認証方式とは独立した選択とする。

鍵は既存の1Passwordで管理する方針でユーザーと合意した。保存先はユーザー指定の `利用者管理の保管庫`。1Password CLI 2.39.0とDocument保存コマンドを確認済み。2026-09-09 18:32 JSTに鍵1件（key ID `4403803`、fingerprint `SHA256:vDjfbYHhcHLEb9L4I84DTUNW3vikby/soZZnOoaskDo=`）の発行をGitHub画面で確認したが、Diaのダウンロードブロックで秘密鍵ファイルの取得は未確認。その後ユーザーが再発行した鍵を1Passwordの `利用者管理の保管庫` にDocument `App秘密鍵の保存項目` として保存した。保存済み鍵のfingerprintは `SHA256:j3DolAZcTa3JO6mnUyYzIdoS5+T5lt9rGedZ1hY+uqo=`。この鍵によるApp認証と読み取り接続確認は成功した。旧鍵の失効状態は未確認。初回はユーザー管理の公開操作から利用し、無人の鍵取得を前提にしない。GitHub Appの鍵は自動失効しないため、試行終了・漏えい時の失効対象も記録する。鍵を保管するだけで、実装者からのアクセス分離を保証したとは扱わない。[公式：Managing private keys](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps)

保管先の比較では、チームでの共有・担当交代を前提に1Passwordを継続する。macOS Keychainは1台のMacでアプリごとのアクセスを管理する用途では候補になるが、ユーザーから認証操作の負担が指摘されたため、1Passwordを正本・KeychainをこのMacの実行用コピーとする方式も評価する。1Passwordの組織向け共有・権限管理機能と、現在の `利用者管理の保管庫` の実際の共有設定・契約機能は区別し、後者は未確認とする。どちらの保管先も、読み出した鍵・tokenを実装環境へ渡さない実行境界の代わりにはならない。[1Password公式](https://support.1password.com/create-share-vaults-teams/)、[Apple公式](https://support.apple.com/en-mide/guide/mac-help/kychn002/mac)

公開操作では鍵からinstallation access tokenを取得し、その操作に必要な権限と対象リポジトリに絞る。tokenは公開用 `gh` プロセスにだけ `GH_TOKEN` として渡し、通常の `gh auth` の保存内容やユーザー全体のshell設定は変更しない。鍵・tokenを標準出力やコマンド引数、リポジトリのファイルに残さない。token取得失敗時は停止し、thktの保存済み認証にフォールバックしない。[公式：gh environment](https://cli.github.com/manual/gh_help_environment)

次の確認は以下の順で行う。鍵の保存・読み取り確認は完了。初期READMEのcommitは完了。CI・保護設定・PR作成はまだ実施していない。

1. 保管先を確定し、鍵を発行・保管する。公開情報のfingerprintでGitHub上の鍵との対応を確認する。
2. 読み取り用tokenで試行リポジトリを識別できることを確認する。秘密情報を含まない結果だけを残す。
3. 初期整備のIssueを作り、初期commitが必要な空リポジトリの扱い、CI、保護設定、最初の確認PRの内容を明記する。最初のmain作成と、以降の人の承認を必須とする運用を区別する。
4. 初期内容・CI・保護設定を導入した後、Issueに紐づく小さな確認PRをAppとして作る。PRの作成者がAppであること、対象branch・commit、必要なCI結果を確認する。
5. thkt本人がレビュー・承認する。エージェントがthktの認証で承認を代行しない。未承認時のマージ制限、承認後の差分変更による再確認も確認する。

実装・テストを行う環境に、Appの鍵・書き込みtoken・thktの既存の書き込み認証が届かないことは、モデル試行前の確認事項とする。同一ユーザーのプロセスを分けたり、環境変数を渡さなかったりするだけでは、この分離の証明にはならない。

2026-09-09の接続確認では、保存したDocumentを内容非表示で取得し、一時鍵ファイルからJWTを作成した。最初の `gh` によるApp認証試行は失敗したため、JWTのBearer認証を明示したHTTPリクエストへ変更した。App ID `4881432` とInstallation ID `160237952` の所有者を照合し、リポジトリID `1362242696` 限定・Contents/Metadata readだけのtokenを発行した。`gh api /installation/repositories` の結果が試行リポジトリ1件だけであることを確認した。確認用tokenは失効済み、一時鍵ファイルは削除済み。1Passwordの保管内容は維持し、リポジトリへの書き込みは行っていない。これは読み取り接続の確認であり、人の承認やCIによるマージ制御の検証ではない。

## 検証の設計

| 観点 | ケース | 確認する結果 |
| --- | --- | --- |
| 要求の理解と合意 | 曖昧な相談、明確な不具合、文書変更、変更不要の結論 | 必要な判断材料を揃え、不要な工程を増やさず、根拠と結果を共有できる。 |
| 合格を誤らないこと | 必須検証の失敗・スキップ・欠落、古い検証結果 | 成功・マージ可能と判定せず、原因に応じた対応へ進む。 |
| 要求と対象の変化 | Issueのみの変更、評価中のコード変更、承認後の変更 | 影響する証拠・評価・承認を見直す。 |
| レビューの質 | 誤った指摘、テストが検出できない誤実装 | 根拠で採否を決め、確認不足を成功と扱わない。 |
| 再開と並行作業 | 中断、担当交代、他者の更新、外部操作の応答不明 | 現在の状態を照合し、重複操作や他者の変更の消失を防ぐ。 |
| 文書と確認環境 | 更新漏れ、生成の再実行、古いプレビュー、セットアップ失敗 | 必要な更新や再確認へ進み、同じ変更・投稿を増やさない。 |
| 資産の利用条件 | 許可外の入力・組み合わせ、資産や検証基準の変更 | 合意済み品質の適用範囲外を検出し、必要なレビューへ戻す。 |

まずモデルを使わず確認できる制御を検証し、その後に隔離した実モデルの作業で、修正・説明・引き継ぎまで確認する。人の判断が必要なケースは実際の判断と模擬応答を区別して記録する。破壊的なケースや応答不明の再現は試行環境で行う。

制御の必須ケースでは、失敗・未検証を成功とする観測が一件でもあれば、その範囲を採用しない。モデルの品質は反復で評価し、数回の成功を一般的な保証にしない。具体的な反復数・実行上限・品質の許容差は、実験前に固定する。

## 比較と計測

比較対象は新構成、現行構成、追加の進行ハーネスを置かない構成を基本案とする。必要ならskillsの効果を別に比較する。全構成でIssue・合意・最終評価・人のレビュー・公開権限を共通にし、守るべき条件を取り除いて速さを比較しない。各構成に残す指示・環境・検証を実験前に明記する。

同じ課題、モデルとreasoning設定、初期コード、外部の受け入れ評価を使う。Astraを使う既存の希望は維持し、実行する版の対応を確認する。費用には実装だけでなく検証・LLMレビューも含め、キャッシュ、入力・出力usage、実行時間を記録する。

要求達成、重要な見落とし、不要な停止、手戻り、人の介入、レビューと引き継ぎにかかった時間、CI・保守の負担を計測する。人の承認待ち時間と実作業時間は区別する。独立した評価に使う時間も分けて残す。

失敗と再試行を消さず、設定を変えた実験は別条件として扱う。制御・モデル判断・レビュー省略の効果を一度に変更して因果関係を主張しない。

## 移行と切り戻し

現行を比較対象として維持し、新構成の検証に必要な課題・根拠を選んで移す。内部状態機械や専用契約を一括コピーしない。一つの変更を二つの構成が同時に書き換えたり公開したりしないよう、担当する構成を特定する。

段階的な移行でもIssueの正本と変更・証拠の対応を維持する。切り戻し時は進行中の変更と外部操作の結果を照合し、別の構成の非公開状態を無条件に読み替えて再開しない。現行コードや古い仕組みの削除は、移行後の確認が済んだ範囲から行う。

## 実装前に確定する判断

| 判断 | 準備する材料 |
| --- | --- |
| 確定した試行先への作成・実行 | `thkt/dotagents-workflow-trial`（Public）の初期内容、利用する資産、資格情報と書き込み先、必要な設定変更。 |
| 自動化用の主体と設定変更の権限 | PR作成は自動化用の別主体、レビュー・承認はthktで合意済み。利用する主体と資格情報、保護設定の変更範囲を具体化する。 |
| 初回の評価課題と具体的な実行条件 | モデル実行上限は上記で合意済み。検証範囲、CIの上限、採否の基準を具体化する。比較実験の反復数・実行上限は別途決める。 |
| 実行方式 | CLI・SDK等で必要な制御を満たす具体案と、重複実装・維持費の比較。 |

技術的な選択は合意済み方針から推奨案を作る。対象環境・権限・実行上限などユーザーの判断が必要な箇所は、具体案を揃えて確認する。この計画の作成を、未確定事項への承認として扱わない。

初期整備の要求は [Issue下書き](trial-setup-issue-draft.md) にまとめた。最初は1Passwordからの鍵取得が失敗した。その後、同一TTYでの認証確認に続けて [Issue #1](https://github.com/thkt/dotagents-workflow-trial/issues/1) を `thkt-dotagents-workflow-trial[bot]` として作成した。確認用tokenは失効済み。

認証頻度の調査では、1PasswordのmacOS認証がttyと開始時刻をもとに識別され、同一セッションでは利用ごとに更新されることを公式文書で確認した。非操作10分、アプリのロック、最長12時間で再認証となる。現在は同一TTYでの再利用を実測する。Keychainはアプリへの常時許可で確認を減らせるが、汎用の `security` コマンドを許可しても呼び出し元の実装コードと公開処理は区別されない。実際の鍵のコピーとアクセス設定変更は未実施。[1Password公式](https://www.1password.dev/cli/app-integration-security)、[Apple公式](https://support.apple.com/en-mide/guide/mac-help/kychn002/mac)

同一TTYの実測では保管庫メタデータ取得が初回6.04秒、2回目1.70秒で成功し、そのまま鍵取得・AppによるIssue作成まで完了した。処理ごとの認証をまとめる改善として有効な観測だが、長時間無人実行や10分後の再認証回避を証明してはいない。公開操作をまとめた同一セッションの利用を当面の最小案とし、Keychainへのコピーは未実施。

最初のmainに置く内容を [初期README](trial-bootstrap/README.md) の1ファイルに限定して準備した。CI・マージ保護・アプリのコードを初期commitへ含めず、以降の設定をPRでレビューできる土台とする。空リポジトリにはPRの比較元branchがないため、この1回のmain直接作成についてユーザーの判断を求める。ユーザーの明示承認後、Appとして初回mainへREADMEだけを作成した。commitは `e6efb270194ee8cdbbfbd1e689c5d744c7fb8d6d`。内容の完全一致とtree内のファイルがREADME1件だけであることをAPIで確認済み。操作用tokenは失効済み。

CI設定を [PR #2](https://github.com/thkt/dotagents-workflow-trial/pull/2) としてAppが作成した。headは `7a4b2659a86a71c1845ac3ae7d92a1ff34664f0b`、[CI run](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34338225463) のverifyは12秒で成功した。Bun 1.4.2、Oxlint 1.80.0、Biome 2.5.12（複雑度上限15のみ）を固定。正常コードの成功、到達不能コード・複雑度超過の失敗をローカルで確認済み。初期workflowのbranch送信は既存ユーザー認証、PR作成はApp認証で行い、AppのWorkflows権限は増やしていない。1Passwordの認証要求が今回も発生し、承認後にPRを作成できた。人のレビュー・マージ保護・失敗等を伴う実際のマージ制御は未確認であり、Issue #1は未完了。

PR #2のマージを確認した（merge commit `1c065c2b15b2dff11588ad514620dd06f2680a31`）。mainの[CI run](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34338476402)も成功。試行checkoutをmainへ更新し、内容一致を確認してローカル `codex/trial-ci` を削除した。GitHub上のreviewsは空であり、正式なApproveの実測とは扱わない。

[main保護の設定案](trial-main-ruleset.json)を準備した。verifyの発行元は実際のcheck-runからGitHub Actions（App ID 15368）と確認した。main限定、PR・承認1件・古い承認の取り消し・会話解決・最新mainとの整合・必須verify・削除/force push禁止、bypassなしを提案する。最終push者以外の承認は要求しない。初期workflowのpushをthktが行い、そのApp作成PRをthktが承認できる構成を維持するためである。現在rulesetは空、classic protectionもなく、適用は未実施。必須チェックだけではskippedを拒否する保証にならず、設定の有効化後に後続PRで不足ケースを評価する。

ユーザー承認後、[main-review-and-ci](https://github.com/thkt/dotagents-workflow-trial/rules/22634025)（ruleset ID `22634025`）をactiveで適用した。bypassは空。mainの有効ルールを読み戻し、PR承認1件・古い承認の取り消し・会話解決・必須verify（GitHub Actions ID 15368）・最新mainとの整合・削除/force push禁止を確認した。main以外の試行名 `codex-test-scope` に適用されるルールは0件。GitHubが返した追加既定値 `require_extra_approval_for_unattributed_changes: true` も記録する。ここまでの確認は設定の適用・対象範囲であり、実際のPRの未承認・失敗・古い証拠の拒否は後続で検証する。

[PR #3](https://github.com/thkt/dotagents-workflow-trial/pull/3)をAppとして作成し、main保護を実測した。head `f33561fed5b3547464249bca85b206ea2b115cdf` では[CI run 34343946008](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34343946008)が意図した到達不能コードで失敗し、`REVIEW_REQUIRED / BLOCKED`だった。この段階は未承認も同時に成立するため、CIだけの拒否効果とは主張しない。検証用ファイルを削除したhead `36134a69c4aa388ab58196c88d75c517dba27e2f` の[CI run 34343973883](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34343973883)は成功したが、引き続き `REVIEW_REQUIRED / BLOCKED`。最終差分がREADMEだけであることを確認済み。マージAPIは呼んでいない。次はthkt本人によるApprove後の状態と、その後の差分更新による承認無効化を確認する。チェック欠落・スキップ、承認済みでのCI単独失敗の阻止は未検証。操作用tokenは失効済み。

PR #3のhead `36134a69c4aa388ab58196c88d75c517dba27e2f` にthkt本人のApproveを確認し、`APPROVED / CLEAN`を観測した。その後READMEに再承認手順を1行追加したhead `7e11e532d9cb0def3da92f895e56ecf94854fd9c` では、旧Approveが `DISMISSED` に変化し、[CI run 34344226829](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34344226829)成功後も `REVIEW_REQUIRED / BLOCKED`となった。承認後の差分更新に対する再承認要求を実測済み。マージは行っていない。PR本文を観測結果に更新し、最新差分の人のレビューを待つ。

PR #3の最終head `7e11e532d9cb0def3da92f895e56ecf94854fd9c` に対するthktの再Approve（2026-09-09T11:12:31Z）を確認した。CI成功とともに `APPROVED / CLEAN`へ戻った。これで未承認→承認→差分更新による承認無効化→再承認の状態遷移を実測した。PRはOPENのまま、マージは未実施。CI単独失敗・チェック欠落/スキップの検証は引き続き未完了。

PR #3は2026-09-09T11:16:10Zにマージ済み（`2f5ca4498b913096377526718a7ef1d785d1035e`）。mainの[CI run 34344655329](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34344655329)も成功した。Issue #1はOPENを維持する。次はチェック欠落・スキップとCI単独失敗の扱いを検証する。承認フローの正常系が成立したことを、これら未検証条件の保証に拡張しない。

CI単独の条件を切り分けるため、main `2f5ca4498b913096377526718a7ef1d785d1035e` から3つの検証専用PRをAppとして作成した。[PR #4](https://github.com/thkt/dotagents-workflow-trial/pull/4)はhead `8f10149b8195533f9e20d73570422ec228db78cd` でverify FAILURE、[PR #5](https://github.com/thkt/dotagents-workflow-trial/pull/5)はhead `d537b6b16d26d0cf8fddc82abd9796640672277e` でverifyが欠落しverify-probe SUCCESS、[PR #6](https://github.com/thkt/dotagents-workflow-trial/pull/6)はhead `27fd51e56af370bb60764b69726c74e8e2eae902` でverify SKIPPED。いずれも承認前はREVIEW_REQUIRED / BLOCKED。人が試行としてApproveした後の状態を確認し、未承認の効果と切り分ける。検証PRはマージせず結果記録後に閉じる。mainは変更していない。

3ケースすべてでthkt本人が各headをApproveした後、PR #4（verify FAILURE）と#5（verify欠落）はAPPROVED / BLOCKED、PR #6（verify SKIPPED）はAPPROVED / CLEANとなった。必須チェック名とGitHub Actions発行元の固定だけではスキップを拒否できないことを実測した。Issue #1の必須検証のスキップを成功扱いしない条件は未達。検証PRはマージせず閉じ、差分と結果は証拠として保持する。最終jobによる実行結果検査と、検証定義そのものの改変に対する信頼境界を次の設計対象とする。

スキップ拒否の最小修正を[PR #7](https://github.com/thkt/dotagents-workflow-trial/pull/7)へ作成した。検証をchecks、必須判定をverifyに分け、verifyはalways()で起動しneeds.checks.resultがsuccessの場合だけ成功する。head `be6f174587f6645115b1245100b999680f412d9d` の[CI run 34346295226](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34346295226)でchecks SKIPPED→verify FAILUREを実測した。検証用のスキップ条件は最終差分から削除済み。job上限はchecks 9分・verify 1分とした。verify自体や検証コマンドの改変を防ぐ保証ではなく、step単位の省略も対象外とREADME/PRに記載した。公開範囲はこの修正PRまでで、マージは未実施。

PR #7の最終[CI run 34346357269](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34346357269)はchecks 8秒、verify 5秒で成功した。verifyのrunner待ちが発生し、job分割による待ち時間も観測した。既存checkout v4に対するNode 20非推奨の注記があり、強制Node 24実行で成功している。Action更新は今回のスキップ修正と分けて扱う。

PR #7の最終head `1698b32760811e74ca7f5985a9e119ab991fcfc9` に対するthktのApprove（2026-09-09T12:54:13Z）を確認した。checks・verifyともSUCCESSで、APPROVED / CLEAN。PRはOPENで、マージは未実施。

PR #7は2026-09-09T12:55:30Zにマージ済み（`73828a047d7a664ef1181bc4db4ee4b59b6abe97`）。mainの[CI run 34353887867](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34353887867)はsuccess。試行checkoutをmainへ更新し、内容一致を確認してローカルcodex/require-check-executionを削除した。検証jobのスキップを必須判定で拒否する修正がmainへ反映された。検証定義・判定job自体の変更の扱いと、Issue #1の完了範囲の確定は残る。

## 検証定義の変更と初期整備の完了範囲（合意済み）

初回は「合意した検証定義を適用し、その定義の変更は人がレビューする」範囲を推奨する。検証定義そのものも合意済み資産として扱う。通常の変更では合意済み定義を再利用し、定義の変更では守っていた条件・変更理由・検出できなくなるケース・代わりの証拠をPRで説明する。CIが緑であることだけを根拠に、この変更を承認しない。

対象はworkflowだけに固定しない。package.jsonの検証コマンド、lint設定、テスト・対象選択、依存関係など、検証結果の意味に影響する変更を含む。網羅的なファイル一覧や別の承認書式を追加する代わりに、既存IssueとPRの要求・差分・証拠で判断する。

この範囲で機械的に確認するのは、合意済みchecksの実行結果がsuccessであること、必須verifyがあること、人の最新承認があることである。人が検証を無効化する差分を見落として承認した場合まで防げるとは扱わない。PR #6の観測を消したり、PR #7がすべての改変を防いだと読み替えたりしない。

現状は全変更をthktがレビューするため、ここだけのためにCODEOWNERSや別の承認jobを足す必要性は低い。担当や権限の異なるチームへ展開するときに、検証定義の承認者を強制する必要を判断する。

一方、「人が誤って承認しても、PR内の変更で判定を無効化できないこと」を初回から必要とするなら、PRから独立した検証定義・判定主体と、その更新権限を設計して実測する。判定jobを同じworkflowに追加するだけでこの条件を満たしたとはしない。独立した判定主体の導入は、設定・資格情報・実行費用・保守の追加範囲になるため別途合意する。

ユーザーが前者を選んだ場合は、その保証範囲をIssue #1と試行READMEへ明記し、実測済み条件・残る制約を対応づけた文書PRをレビューしてから初期整備を完了する。後者の場合はIssue #1を継続し、独立した判定の設計へ進む。どちらも未選択の段階ではIssue #1を閉じない。

ユーザーは、通常変更で合意済み検証を再利用し、検証変更の条件・理由・検出力への影響を説明し、機械が実行結果・必須チェック・最新承認を確認した上で人がレビューする方針に同意した。さらにPRの図・具体例・画面等によるレビュー支援を追加することを承認した。試行リポジトリのDEVELOPMENT.mdへ実測範囲とともに記載する文書PRを準備した。文書PRのマージを確認してからIssue #1の初期整備を完了として整理する。

[PR #8](https://github.com/thkt/dotagents-workflow-trial/pull/8)をAppとして作成した。headは `06e765abddf75dfd6f9b9a05e7bed636cec654b1`。DEVELOPMENT.mdとREADMEにレビュー責任・説明支援・実測済み範囲と制約を記載し、PR概要にフロー図を添えた。ローカルの `bun run check` と `git diff --check`、[CI run 34354921502](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34354921502)のchecks・verifyが成功した。Issue #1の現在地・完了条件・合意した保証範囲も更新済み。PRはOPEN / REVIEW_REQUIREDで、人の承認・マージを待つ。Issue #1はOPENを維持する。

PR #8はthktの最新headへのApprove後、2026-09-09T13:13:36Zにマージ済み（`d8889ad27a6df6bbc152080234d9acb330e38df5`）。[main CI 34355744605](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34355744605)はsuccess。試行checkoutのmainをfast-forwardし、差分一致を確認してローカルcodex/document-review-boundaryを削除した。作業ツリーはclean。Issue #1に完了証拠と保証範囲を記録し、completedとして閉じた。次は初回のアプリ試行について要求・完了条件・検証方法をIssueで具体化する段階であり、アプリ実装やLLM実験はまだ開始していない。

ユーザーがフロー評価としての試行開始に同意したため、Appとして[Issue #9](https://github.com/thkt/dotagents-workflow-trial/issues/9)（一覧資産の準備）と[Issue #10](https://github.com/thkt/dotagents-workflow-trial/issues/10)（検索追加とフロー評価）を作成した。商品完成とフロー評価を分け、#9の人の承認・マージを#10の開始条件とした。codex/trial-product-listで#9の実装準備を開始。Astra/highのモデル実行はローカルCLIのJSONL・終了状態・実時間を 一時作業パス（省略） に保存する。初回はCLIの排他オプション指定でモデル起動前に失敗し、ログを保持して修正した。独立評価の完了は実装者の自己申告と区別する。

Issue #9はAstra/highの実装1回（349.29秒）と独立評価1回（158.35秒）を実施し、評価はaccepted。CLI起動前のオプションエラー1件とsandboxでの依存導入・ブラウザ起動失敗を保持し、通常の承認経路で復旧した。親タスクが進行と公開を担当しており、自律ハーネスの復帰制御の検証とは扱わない。実装commit `2e9e3f2901a15fb7bd994b56780e843a65babd6d` で最終checkが成功（Chromium desktop/mobile 2 passed）、再生成画像がcommit内の証拠2枚とバイト一致。実装・修正残り2回、独立評価残り2回、モデル実行累計約8分28秒。usageと全モデルログはローカルに保持。GitHub AppによるPR公開を進める。

ユーザーの明示依頼で、1Password原本を維持し、login KeychainへApp鍵の実行用コピーを登録した。serviceは `thkt.dotagents-workflow-trial.github-app`、accountは `4881432`、確認なしの取得を許可するアプリは `/usr/bin/security` に限定した。同一ユーザーの他スクリプトも同CLIを介して取得可能であることを説明済み。秘密値はコマンド引数・ログへ出さずSecurity.frameworkで登録。security CLIの読み戻しが16進表現だったため復元し、既知の公開鍵指紋 `SHA256:j3DolAZcTa3JO6mnUyYzIdoS5+T5lt9rGedZ1hY+uqo=` と照合した。別呼び出しで取得後、Keychain版の公開スクリプトで[PR #11](https://github.com/thkt/dotagents-workflow-trial/pull/11)をAppとして作成できた。headは `2e9e3f2901a15fb7bd994b56780e843a65babd6d`、操作用installation tokenは失効済み。Keychainロック時の解除、Codexの操作承認、PRへの人の承認は別の境界として維持する。実行用スクリプトは `一時作業パス（省略）`。

PR #11の[CI run 34359478765](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34359478765)はchecks 37秒、verify 4秒で成功。Linuxの新規runnerで依存導入・Chromium準備・共通checkを確認できた。PRは人のレビュー・承認待ち。

PR #11はthktのheadへのApprove（2026-09-09T13:50:50Z）後、13:52:27Zにマージ済み。merge commit `f97b76d0129ec33ee26544fe408ed9e62ec26b8f` の[main CI 34359900539](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34359900539)はsuccess。試行checkoutをmainへfast-forwardし、内容一致を確認してローカルcodex/trial-product-listを削除した。作業ツリーはclean。Issue #9を初期資産完了として閉じ、Issue #10へ再利用基準commitと残り実行上限（実装・修正2回、独立評価2回、モデル待ち時間約51分32秒）を記録した。検索と障害からの復帰評価は未開始。

Issue #10はcodex/trial-product-searchで開始。実行前に固定した評価手順をIssueへ公開し、Astra/high実装2/3回目（279.60秒）で正常候補を作成した。共通checkは18件成功。正常候補を保存し、検索対象セルのtoLowerCaseを外す一時変更でcheck exit 1、復元後exit 0を観測。ソースhashの不一致により古い成功証拠を適用不可とした。これは親タスクによる復元・証拠確認の試行であり、自律ハーネスの制御実績とはしない。続いてREADMEだけ一覧段階へ戻してcheck exit 0を確認し、注入箇所を教えず独立評価2/3回目を開始した。

Issue #10の独立評価2/3回目はneeds_changesで、意図的に戻したREADMEの古い検索未実装表記・仕様欠落を検出した（106.43秒）。修正3/3回目は現在の実装と監査指摘からREADMEだけを修正（155.87秒）。最終独立評価3/3回目はaccepted（116.28秒）、共通check 18件成功。元候補にはREADME更新があり、文書漏れは自然発生のミスではない。最終commit `75a87b5eed6f9a675604244eaeaa4ca14c461788` に評価結果と6画像を含め、commit上のcheck 18件成功と画像バイト一致を確認してpushした。モデル実行累計1165.82秒、実装修正3/3回・独立評価3/3回を消化。追加モデル実行は行わない。評価の制約とusageは試行リポジトリのevidence/issue-10/evaluation.mdに記録した。

Keychainから取得した鍵でAppとして[PR #12](https://github.com/thkt/dotagents-workflow-trial/pull/12)を作成した。head `75a87b5eed6f9a675604244eaeaa4ca14c461788` の[CI run 34362663585](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34362663585)はsuccess。操作用tokenは失効済み。PRは人のレビュー・承認待ち、Issue #10は未完了。

ユーザーの依頼で、PR #12の画像を状態×画面幅の比較表へ再配置し原寸リンクを追加した。検索・コード照合・該当なし・全削除復帰の実操作動画を撮影し、MP4と撮影対象・手順を保存した。最新head `ea291aef3b9aeebde90428274daeb711de35d762` は説明方針と動画のみの追加で、アプリ・テスト・検証は前commitと一致。GitHub上で比較表・動画リンクの表示を確認した。local development-policy-draft.mdと試行DEVELOPMENT.mdにも、画像配置の工夫と操作・遷移変更での動画撮影を明記した。追加のモデル評価実行は行っていない。

ユーザーの依頼で、約35秒の日本語合成音声（macOS Kyoko）付き操作動画を作成した。音声の長さに合わせて実画面を再撮影し、操作結果と解説を同期。撮影対象headはea291aef3b9aeebde90428274daeb711de35d762。gh pr edit --attachを使用してPR #12へ直接添付し、GitHubの添付URL https://github.com/user-attachments/assets/ead10825-9b40-470f-bdd1-96496953562b とbody_html内のvideo要素を確認した。PR内でプレイヤーとして表示される。リポジトリへの追加commitはなく、アプリ・検証の変更もない。ローカル方針に直接再生できる添付優先と、合成音声の明記・タイミング対応を追記した。


### ブラウザ検証・撮影の標準を決定（2026-09-09）

agent-browser 0.37.0 / Chromeで商品検索の操作・録画を試行した。検索状態5種類に加え、キーボードイベントによる1文字ずつの入力と途中の結果件数を確認できた。macOS Kyokoの音声合成には引き続きFFmpegによる編集が必要だった。この試行だけではPlaywrightに対する工数削減・品質向上を示せていないため、ユーザー合意によりE2Eと定型デモ撮影はPlaywrightを標準とする。agent-browserは探索的な画面確認が必要な場合の任意の補助手段とする。解説音声はmacOS Kyokoを採用する。試行成果物はローカルのartifacts/agent-browser-demoに保存し、この決定によるアプリ・CIの変更はない。

PR #12へ撮影・音声の確定方針を反映した。最新headは `4e3d3486cdbe57ff7f677bba6e8a7d6b2c2297d2`。追加差分はDEVELOPMENT.mdの3行のみで、アプリ・テスト・依存関係・CIの変更はない。PR説明に最新headと既存評価・動画の対象commitを区別して記載した。CI run 34367243863はchecks 39秒・verify 3秒で成功。試行checkoutはclean。人のレビュー・承認・マージは未実施で、Issue #10の完了はその後に確認する。

図の形式もユーザーと合意し、Mermaidを基本に、複雑なら分割、必要なら別形式と編集元を使い、要点を文章でも説明する方針を設計文書とPR #12に反映した。追加commit `ac5dec906c57f8176a3e9265ccb339b10f74c7b9` はDEVELOPMENT.mdの1行のみ。PR本文の最新headも更新済み。

PR #12は2026-09-09T15:09:09Zにマージ済み（main `5cff1d6f0ae8ad839e23c05965f8128a72998429`）。最新headへの人の承認とmain CI 34368346979のsuccessを確認した。試行checkoutをmainへfast-forwardし、差分一致を確認してローカルcodex/trial-product-searchを削除した。初回試行の完了証拠と未評価範囲をIssue #10へ記録して閉じる。次のモデル実験は新たな範囲・実行上限の合意が必要。

Issue #13の接続をCLIとして実装し、制御テスト12件・既存E2E18件を確認した。実行コードのcommitは `8fd0c9d`。`一時作業パス（省略）` の隔離コピーへ不具合と文書漏れを与え、合意済み上限で実モデル試行を開始した。正常なアプリ・検証の正本へ不具合は入れていない。

Issue #13の実モデル試行は修正1回（73.10秒）・独立評価1回（33.30秒）、計106.40秒でready_for_human_review。checkは6件失敗・12件成功から修正後18件成功となり、親タスクの中継なしで進んだ。READMEも初回修正で直ったため実モデルの文書差し戻しは発生していない。制御テストは14件成功。同じ試行の再照合では追加モデル実行なし。PR #14をApp名義で公開した（head `9fc6f6d79db9808c966f6f460e8d497ee6ea118d`）。実行コードは試行時の8fd0c9dと同一。制御CLI自体への独立LLM監査とは区別し、人のレビューを依頼する。

PR #14のCI run 34371427907はchecks 45秒・verify 2秒で成功。ローカルの静的検証・制御14件・既存E2E18件も成功済み。PRは人のレビュー・承認待ちで、Issue #13はOPENを維持する。追加のモデル実行は行っていない。

PR #14は2026-09-09T15:53:39Zにマージ済み（main `78a99c66013968a899c18952c32770ee6546a996`）。main CI 34373236262成功を確認し、ローカルmainの更新・内容一致確認・codex/trial-correction-loopの削除を実施。Issue #13を完了として閉じた。

続いてIssue #15で制御コードとテストだけのTS化を具体化し、PR #16をApp名義で公開した（head `89cd430651ec10e0dc5cfce8bf9a469d1b2fdeec`）。TypeScript 7.0.2・@types/bun 1.4.1を固定し、strictなtsc --noEmitを共通checkへ追加。ローカル型検査・制御14件・E2E18件は成功。bun testとPlaywright、アプリのJSと既存検証条件は維持した。実モデルの追加試行は行っていない。

ユーザーのコード整理依頼をPR #16へ反映（追加commit `5df7cc1`）。不要な結果型プロパティ・未使用の返却フィールドを削除し、JSON応答の共通読み取り、テスト後片付け、プロンプトの可読性を整理した。nullの修正応答を明示的なinvalid_repairへ揃え、コマンド起動失敗をstderrへ保存。回帰テスト3件を追加し、ローカルの型検査・静的検証・制御17件・E2E18件が成功した。通常の進行と上限は維持し、実モデルの追加実行は行っていない。

PR #16は2026-09-09T16:31:56Zにマージ済み（main `3f602e352735287a4d0f8f61b20948b3728cd415`）。[main CI 34377316277](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34377316277)のsuccessを確認した。制御17件・E2E18件と型検査・静的検証が成功。ローカルmainを更新し、内容一致を確認してcodex/typescript-controlを削除した。作業ツリーはclean。Issue #15へ完了証拠を記録し、completedとして閉じた。実モデルの追加試行は行っていない。

Issue #17で中断・再実行の検証を具体化し、[PR #18](https://github.com/thkt/dotagents-workflow-trial/pull/18)をApp名義で公開した（head `a9582d6e5b3c1cf963b089e317b507a6b784d9a4`）。修正前はSIGTERMでCLIを停止した後も孫プロセスが書き込み続けることを再現した。SIGINT/SIGTERMで実行中のグループを停止し、出力保存後にactive予約を保持して異常終了する処理を追加。check・repair・reviewに対する3種類のsignal、並行起動・再実行の拒否、完了後のIssue変更を検証し、ローカルの静的検証・型検査・制御27件・E2E18件が成功した。SIGKILLはlockによる再実行拒否だけを保証し、孤児プロセスの自動停止や自動復旧は対象外。実モデルの追加実行は行っていない。人のレビュー・承認待ち。

PR #18の[CI run 34378375126](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34378375126)はchecks 1分6秒・verify 4秒で成功。macOSのローカル検証に加えてLinux CIも成功した。Issue #17とPR #18は人のレビュー・承認・マージ待ち。

PR #18のコード整理を実施（追加commit `618807c882098674342dc62efee6e75fd2a88b1b`）。中断の共通メッセージを一元化し、テストの多重文字列生成を引数渡しへ変更。手作りの中断状態テスト1件を実CLIの中断・再実行テストへ統合し、文書・Issue変更後の再照合を共通化した。既存条件を維持し、ローカルの型検査・静的検証・制御26件・E2E18件が成功した。PR本文にも検証統合の対応関係を記録した。

PR #18は2026-09-09T16:49:40Zにマージ済み（main `aa5f9fef6bcd7a957609c63326cbdb3e08b028a7`）。[main CI 34379157883](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34379157883)はchecks 42秒・verify 2秒で成功。Issue #17のクローズを確認し、完了証拠を記録した。ローカルmainを更新し、内容一致を確認してcodex/interruption-safetyを削除。作業ツリーはclean。SIGKILL時の子の自動停止や完全自動復旧は引き続き保証範囲外であり、実モデルの追加実行は行っていない。

Issue #19でTypeScriptの書式・基本ルールの強制を具体化し、[PR #20](https://github.com/thkt/dotagents-workflow-trial/pull/20)をApp名義で公開した（head `ebfe9ec174b767516b8e6be4883fc536b67515e0`）。scripts/**/*.tsにOxfmt 0.66.0とOxlintの7ルールを適用し、format:checkを共通checkへ追加。Biomeは認知的複雑度15のみ、strict型検査と既存テストを維持する。一時TSで7ルールの拒否と書式違反の検出・修復を確認し、一時ファイルを削除した。ローカル共通check（制御26件・E2E18件を含む）は成功。過去のevidenceと商品アプリJSは再整形していない。人のレビュー・承認待ち。

PR #20は2026-09-09T17:02:39Zにマージ済み（main `0d9a6e46f9a4a70b59e766b5aabe8d07288d5f39`）。main CI 34380485946のsuccessを確認し、ローカルmainを更新、内容一致を確認してcodex/typescript-styleを削除した。

Issue #21で型付きlint・noUncheckedIndexedAccessを具体化し、[PR #22](https://github.com/thkt/dotagents-workflow-trial/pull/22)をApp名義で公開した（head `09725baa93f1a45db378ced3843a0d3166c9f587`）。oxlint-tsgolint 7.0.2001を固定し、Promise3ルールとunsafe5ルールを追加。診断の中心はJSON由来のanyと未確認のCLI引数だった。input.tsで設定と保存状態を確認してから使い、不正記録は保持して停止する。不正入力の8件を追加し、ローカル共通check（制御34件・E2E18件含む）は成功。一時TSで8ルールと配列アクセスの拒否も確認し、一時ファイルは削除した。実モデルの追加実行は行っていない。人のレビュー・承認待ち。

PR #22は2026-09-09T17:13:05Zにマージ済み（main `895c06e80c66c560df59bd11a526fb1f1d634176`）。[main CI 34381550063](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34381550063)はchecks 45秒・verify 4秒で成功。Issue #21のクローズを確認し、完了証拠を記録した。ローカルmainを更新、内容一致を確認してcodex/typed-lintを削除した。作業ツリーはclean。型付きlint・書式・複雑度・型検査・制御34件・E2E18件が成功し、実モデルの追加実行は行っていない。

Issue #23でテスト選択・除外の拒否を具体化し、[PR #24](https://github.com/thkt/dotagents-workflow-trial/pull/24)をApp名義で公開した（head `ae96d451f5d0978c3fd4604540cc6b97b060c53f`）。Oxlint 1.80.0のJest用ルールではbun:testとPlaywrightのimportを検出しないことを実測。テストディレクトリ限定のno-restricted-properties/imports/globalsでonly・skip等を拒否した。通常のdescribe・eachや対象外の同名プロパティを含む45件の一時コードで構文判定を確認し、ローカル共通check（制御34件・E2E18件含む）は成功。追加依存関係や独自解析器はない。動的なプロパティ名や任意の条件分岐等の限界と、人による例外レビューを明記した。人のレビュー・承認待ち。

PR #24は複雑さを再検討するためdraftへ戻した。Bun 1.4.2はCI=trueならtest.only/describe.onlyを標準で拒否し、Playwright 1.63.0も既存forbidOnlyで拒否することを実測した。Bunのskip/todoは成功終了するがJUnitのskippedに記録され、Playwrightのskip/条件付きskip/fixmeもJSON stats.skippedに記録される。onlyは既存機能、未実行は標準レポートの判定に責任を分ける案へ変更する。現在の汎用lint制限の置き換えはまだ行っていない。実測ログは試行checkoutのartifacts/runner-probe-ju2yisl1に保持。PRに再検討結果を記録した。

PR #24をrunner標準機能と実行レポート判定へ置き換えた（head `437ced90274bc8bbd83b73482fab74eb23b52434`）。汎用Oxlint制限は削除し、test:control/test:e2eをscripts/test.tsへ接続。CI=true/forbidOnly、runner成功、テスト0件でないこと、未実行0件を確認する。毎回新しい保存先を作る。実runnerの14ケースと集計不備6ケースを追加し、ローカル共通checkは制御54件・E2E18件を含め成功。Bun固定版のJUnit集計形式に限定した読み取りであり、依存関係の追加はない。CI確認後にレビュー可能へ戻す。

PR #24は2026-09-10T02:35:03Zにマージ済み（main `2256dcf0c5619553b792963c64bd40b2a1d1be2c`）。[main CI 34430019942](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34430019942)はchecks 1分7秒・verify 2秒で成功。Issue #23のクローズを確認した。ローカルmainを更新し、内容一致を確認してcodex/test-selection-guardを削除。試行checkoutの作業ツリーはclean。共通checkは制御54件・E2E18件を含め成功し、実モデルの追加実行は行っていない。

Issue #25の文書整理を現行TS版CLIで試行し、初回check成功→独立評価needs_changes→修正1回→check成功→独立評価acceptedまで中継なしで完了した。自動区間はモデル360.46秒。公開前の確認で、試行固有条件が共通CLI手順へ追記されていたため、親タスクが試行記録へ移す編集介入を1件実施。残りの独立評価1回もacceptedで、合計修正1/2回・評価3/3回・439.72秒。最終共通checkは制御54件・E2E18件を含め成功。修正担当による重複checkのE2EはEADDRINUSEで失敗したが、ホスト側の最終checkは成功。根本原因は未確定。準備・公開の正確な時間は未計測として残した。簡素化候補はcheckの担当分離、個別条件を共通文書へ持ち込まないこと、準備・公開スクリプトの反復編集。Appとして[PR #26](https://github.com/thkt/dotagents-workflow-trial/pull/26)を公開した（head `a5b5813ed182a4d7dd69bc3eb6a73dde672ed30b`）。共有証拠はevidence/issue-25、生ログは一時作業パス（省略）に保持。人のレビュー・承認待ち。

PR #26のCI 34432515191はchecks 1分2秒・verify 3秒で成功。headはa5b5813ed182a4d7dd69bc3eb6a73dde672ed30b。人のレビュー・承認待ち。

PR #26は2026-09-10T03:15:20Zにマージ済み（main `854aeacdd7ad9fb97b22e18cc5194bac3d5ef860`）。[main CI 34432626384](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34432626384)はchecks 53秒・verify 4秒で成功。Issue #25はクローズ済み。共有checkoutと隔離コピーのmainを更新し、内容一致を確認してcodex/documentation-simplificationを削除した。試行用node_modulesリンクのみ取り外し、両作業ツリーはclean。生ログ・状態・設定は保持している。

Issue #27で基本文書を現在の手順・判断基準に揃えた。README・DEVELOPMENT・scripts/READMEから不要な経緯や過去版比較を除き、既存記録への索引をevidence/README.mdに集約。更新方針はDEVELOPMENT.mdに明記した。AppとしてPR #28を公開（head 23c733368b8a2f5bec9d25600d84e144eaefa35d）。ローカル共通checkは制御54件・E2E18件を含め成功し、リンク42件も確認済み。コード・検証定義・既存履歴本文の変更と実モデル追加試行はない。

PR #28は2026-09-10T04:01:34Zにマージ済み（main `5fce1f3c7633cfa36821b2e56173e8d1f9226940`）。[main CI 34435557524](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34435557524)はsuccess。Issue #27はクローズ済み。ローカルmainを更新し、内容一致を確認してcodex/current-documentationを削除した。作業ツリーはclean。

Issue #29で修正担当の局所確認とホストの共通checkの担当分担を明記した。変更は修正プロンプトとscripts/READMEの2ファイル、4行追加・1行削除。制御ロジック・停止条件・結果形式は変更していない。ローカル共通checkは制御54件・E2E18件を含め成功。AppとしてPR #30を公開（head a08a087a7372935ac05e1da3b34abf224f0106c6）。重複実行の削減効果と修正品質は実モデル未評価で、EADDRINUSEの原因解決とは扱わない。

PR #30は2026-09-10T04:16:07Zにマージ済み（main `50cc2f52e5880ef6ca2218c2260824626ac1b1eb`）。[main CI 34436522985](https://github.com/thkt/dotagents-workflow-trial/actions/runs/34436522985)はchecks 56秒・verify 2秒で成功。Issue #29はクローズ済み。ローカルmainを更新し、内容一致を確認してcodex/check-ownershipを削除した。作業ツリーはclean。重複実行削減の実モデル評価は未実施。

Issue #31でPR #30の担当整理を実測。作業コピーと要求本文はIssue #25と同一、制御TSの差分は修正指示だけ。CLI版は0.153.4→0.154.0で異なる。共通check重複は1→0回、ホストcheck2回成功・修正1回・評価2回acceptedまで中継なし。モデル365.15秒で前回360.46秒より短縮せず、個別試行条件の共通文書への混入も残った。生成文書は取り込まず、結果と未修正の差分をevidence/issue-31へ保存。準備89.16秒・制御406.83秒。AppとしてPR #32を公開（head 76a6c109f74285a2e12df2f5dbc218600cde61ee）。次の候補は成果物の要求と実験運用の説明の分離。

PR #32のCI 34437484500成功。公開計測：準備 89.16秒、制御実行 406.83秒、事後確認 16.57秒、公開準備からPR作成 182.64秒、PR作成からCI完了 69.00秒。壁時計時間で待機を含みます。

Issue #33で制御・入力・標準機能の棚卸しを行い、check失敗ログのファイル保存と全文埋め込みの重複を削除した。保存先を渡し、既存正常経路を実ログ参照が必要な模擬actorへ強化。変更前失敗・変更後成功と共通check成功（制御54件・E2E18件）を確認。PR #34をAppとして公開（head 968b5ae6184561da327cbc9b8f49c2f9d6e063c0）。候補は標準stream API、gh pr createを使う公開処理、成果物要求と実験運用の分離。snapshot・lock・予約は保証を維持するため残す。PR #32とは独立し、実モデルの追加試行は行っていない。

PR #34のマージ（a65f8f2c95b3f7c6197729978002e34971207ea5）を確認。次はユーザー合意の3点、公開スクリプトの引数化とgh pr create、手作り終了待ちの標準stream API化、成果物要求と実験手順の分離を小さなPRで進める。Bun 1.4.2でnode:stream/promisesのpipelineによる2 MiB保存、finished完了待ち、書き込みエラー、途中close拒否を実測し成功。probeは一時作業パス（省略）。これは既存actorへの統合検証を済ませた意味ではない。

Issue #35でPR公開をscripts/publish.pyへ集約し、head/title/body-fileを引数化、作成をgh pr createへ委譲した。App鍵指紋・installation・限定tokenと失効を維持。模擬5ケースと共通checkが成功し、新入口からAppとしてPR #36を作成できた（head 970e275a5a7be8ca275b31b4c8cb18154af316d7）。既存Python処理の移設であり、新しいパッケージ依存はない。次はstream APIへの置換、成果物要求と実験運用の分離。

ユーザー合意によりPR #36をTypeScriptへ変更。scripts/publish.tsとBunテストへ統一し、Python版・専用検証を削除。node:cryptoでメモリ内署名するためOpenSSL呼び出しと一時鍵ファイルも不要。公開テスト9件を共通checkへ統合し、63件・E2E18件成功。TS版の実App認証・既存PR #36照会・token失効も成功した。新規PR作成は模擬コマンドでの検証。
