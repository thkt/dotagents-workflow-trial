# 検証・監査から修正へ戻す試行

Issue #13のための小さな実行入口です。常駐サービスやSDKは追加しません。

```text
bun scripts/correction.ts /absolute/path/config.json
```

設定は信頼する公開・実行担当が用意し、作業コピーと証拠ディレクトリを分けます。

```json
{
  "cwd": "/absolute/path/isolated-worktree",
  "runDir": "/absolute/path/evidence",
  "issue": ["gh", "issue", "view", "13", "--repo", "thkt/dotagents-workflow-trial", "--json", "title,body,updatedAt"],
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

設定・制御コード・証拠は修正対象から分離します。この分離や記録は、同一ユーザーによる悪意ある改変へのセキュリティ境界ではありません。検証定義の弱体化は独立評価と人のレビューでも確認します。

## 検証

`bun run test:control`は一時Git作業コピーを用意し、本番と同じCLI入口へ制御可能なコマンドを渡します。モデル呼び出しを行わず、成功・失敗・文書不足・対象変更・応答不正・人の判断要求・上限・再実行を確認します。check・repair・reviewそれぞれの実行中にSIGINT/SIGTERM/SIGKILLを送信し、同時起動の拒否・予約の保持・再実行の拒否を確認します。SIGINT/SIGTERMでは孫プロセスの継続書き込みが止まることも確認します。SIGKILLのテストは残存プロセスをテスト側で後片付けします。

共通`bun run check`にはこのテストを追加します。既存のlint・複雑度条件・18件のPlaywright E2Eは維持し、検出できなくなるケースはありません。模擬コマンドの成功は、実モデルの判断品質の証拠には数えません。

制御コードとそのテストはTypeScriptです。`bun run typecheck`で`strict`の型検査（`tsc --noEmit`）を行い、共通checkにも含めます。Bunによる実行だけでは型検査を行いません。商品アプリのJSは型検査の対象外です。設定・LLM応答の既存の実行時検証は維持し、設定・保存状態のJSONはunknownとして読み、必要なフィールドの形と値を確認してから使用します。不正な保存状態を初期化して続行しません。これは記録の改ざん防止や履歴全体の整合性を保証するものではありません。型検査が外部データの正しさを保証するわけではありません。

TSを編集したら`bun run format`で書式を揃え、`bun run check`で書式・lint・型・動作をまとめて確認します。書式はOxfmt、型専用importなどの書き方はOxlintで制限します。[適用範囲とルール](../DEVELOPMENT.md#typescriptの書き方issue-19)を参照してください。
