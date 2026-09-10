# 制御CLIの試行手順

合意したIssueに対して、check失敗または独立評価の`needs_changes`から修正・再検証・再評価へ接続する実行担当向けの入口です。この文書をCLIの操作・実行制約の正本とします。
通常の商品アプリ開発は[README](../README.md#セットアップと検証)、PRと人のレビュー・承認は[DEVELOPMENT.md](../DEVELOPMENT.md)を先に確認してください。共通check内の制御テストは模擬コマンドを使いますが、ここで説明するCLI試行は実モデルを呼びます。

## 準備と実行

```text
bun scripts/correction.ts /absolute/path/config.json
```

設定は信頼する公開・実行担当が用意します。mainから隔離した作業コピーを用意し、設定・制御コード・証拠ディレクトリを修正対象の外へ配置します。以下は設定形式の例で、Issue番号・絶対パス・実行上限はその試行で合意した値を起動前に設定してください。例の値自体は新たな実行許可を意味しません。

```json
{
  "cwd": "/absolute/path/isolated-worktree",
  "runDir": "/absolute/path/evidence",
  "issue": ["gh", "issue", "view", "ISSUE_NUMBER", "--repo", "thkt/dotagents-workflow-trial", "--json", "title,body,updatedAt"],
  "check": ["bun", "run", "check"],
  "repair": ["bun", "/absolute/path/controller/scripts/codex-actor.ts", "repair", "/absolute/path/evidence"],
  "review": ["bun", "/absolute/path/controller/scripts/codex-actor.ts", "review", "/absolute/path/evidence"],
  "repairLimit": 2,
  "reviewLimit": 2,
  "modelTimeMs": 1200000,
  "checkTimeMs": 540000
}
```

`issue`は参照先を含む実際の作業要求を取得するコマンドです。上の例は単一Issueの取得方法であり、参照する別Issueの本文が必要な試行では取得対象に含めます。作業担当へ渡す題材と、制御側の実装要求を区別してください。GitHubの書き込みコマンドはこの入口にありません。

`repair`と`review`は要求・失敗根拠を標準入力で受け取り、結果のJSONだけを標準出力へ返します。評価は`status: accepted | needs_changes`と文字列`findings`、修正は`status: repaired | needs_human`と文字列`findings`です。欠落・不正・実行失敗は停止し、成功には読み替えません。これは呼び出し間の最小の結果形式で、Issueの完了条件を置き換える契約ではありません。

付属のCodex呼び出しはAstra/highを使い、修正はworkspace-write、評価はread-onlyで新しい実行を開始します。評価者はコード・テスト・文書を読み、ホスト側checkの結果と分けて評価します。実行前にCodexへログインし、対象モデルが利用できるCLIを用意してください。GitHub Appの鍵や書き込みtokenを作業環境へ渡さないでください。

修正担当は調査・修正に必要な箇所を確認し、共通checkはホストが修正後に実行します。独立評価担当は共通checkを再実行せず、要求・コード・テスト・文書の妥当性を確認します。これはCLI試行での担当分担です。

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

制御テストの成功は実モデルの判断品質の証拠には数えません。実測結果とその対象・未検証範囲は[検証記録](../evidence/README.md)を参照してください。
