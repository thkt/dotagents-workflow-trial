# 保存・評価CLI

信頼するcheckoutの`scripts/discovery.ts`をBunで実行する。このスキルのディレクトリからは`../../scripts/discovery.ts`にある（この参照文書からは[discovery.ts](../../../scripts/discovery.ts)）。CLIはLLM・GitHub・ブラウザーを起動しない。必要な調査とユーザーとの会話は担当者が行う。

## 開始設定

設定ファイルに次を指定する。絶対パスは利用環境に合わせ、repoとcontextDirは別の場所にする。contextDirは/tmpの作業コピーとは別の、継続保存する場所を選ぶ。

```json
{
  "repo": "/absolute/path/to/repository",
  "contextDir": "/absolute/path/to/private-context/github.com/owner/repository",
  "task": "reset-discovery",
  "referencePaths": ["README.md", "DEVELOPMENT.md"],
  "criteriaFile": "/absolute/path/to/skills/scoping/references/criteria.json",
  "request": "絞り込み後に元の一覧へ戻す操作を分かりやすくしたい"
}
```

```sh
bun scripts/discovery.ts start /absolute/path/config.json
```

出力したSESSIONを以降のコマンドへ渡す。同じtaskの開始は上書きせず失敗する。contextDirはGitの共通管理ディレクトリに紐づき、同じリポジトリのworktree間で共有する。GitとBunが必要。別cloneは同じremoteでも別の保存先を使う。対象worktreeのrepoと新しいtaskを指定して開始し、researchから適用できる調査を選ぶ。セッションごとのcheckout・基準・評価は共有せず、現在のコード・要求に対して再評価する。

criteriaFileはIDをキー、問いを非空文字列とするJSONオブジェクト。開始時の全文を保持するので、元ファイルの変更で実行中の基準は変わらない。referencePathsは参照候補であり、存在・内容・十分性をCLIが検証したという意味ではない。外部資料のURL・版と選択理由はnoteに残す。

## 操作

| 操作 | 入力・結果 |
| --- | --- |
| `status SESSION` | 依頼、基準、revision、根拠、評価、決定の参照を表示する |
| `note SESSION NOTES.md` | 根拠・決定の正本への参照・未解決事項を保存する。旧評価を無効にする |
| `assess SESSION ASSESSMENT.json` | 現在のrevisionと全基準への評価を保存する |
| `gate SESSION` | 未評価・不足なら終了1、充足なら次の判断を表示して終了0 |
| `archive SESSION REPORT.md` | gateが通る場合だけ完了した調査記録をresearchへ保存する。同じセッション版・本文の再保存は同じファイルを返す |

start・note・assess・archiveの終了0は保存成功を示す。assessが不足を保存した場合も0であり、進行の判定には必ずgateを使う。エラー時は非zero。statusは読み取りのみ。gateは更新との競合を防ぐため一時lockを使うが、保存済みの評価は変更しない。

以下は説明用に基準がpurposeの1項目だけの場合の評価例。実際にはセッションの全IDをchecksへ含める。未評価の項目を省略しない。

```json
{
  "revision": 0,
  "decision": "一覧復帰のUI方針を選ぶ",
  "checks": {
    "purpose": { "status": "missing", "reason": "元の一覧に戻した後の期待が未確定" }
  },
  "next": "UI実装を保留する。チャットで復帰後の期待を確認し、決定をIssueに記録して再評価する"
}
```

質問と回答はチャットで扱う。方針の決定は[開発方針](../../../DEVELOPMENT.md#対話と方針の決定)に従って記録し、noteには正本への参照と次の判断への影響を残す。回答の受領や記録の保存だけでgateは成功にならない。次の判断に進む前に現在のrevisionで全基準を再評価する。

## 保存と制約

contextDirのwork/task/state.jsonがセッション記録の正本。調査記録はresearch内のMarkdownへ保存し、セッションとrevisionを付ける。出典・確認日・適用範囲・未確認事項はREPORT.mdに含める。要求合意の正本はGitHub Issueであり、state.jsonはその代替ではない。

CLIは対象checkout・Git管理ディレクトリ内への保存、別GitリポジトリによるcontextDirの再利用、既存taskの上書きを拒否する。共有保存庫は参加する全checkoutの外に置く。更新はlockと一時ファイルからの置換を使う。ロックやstate.json.tmpが残った場合は自動で削除・再開せず、実行中のプロセスと保存済み内容を照合してから対応する。

信頼する担当者が操作する単一ホスト用。悪意ある同一ユーザーによる保存ファイルの改変、外部資料の変更検出、全ディスク障害への耐久性は保証しない。gateは保存時の評価を返すため、外部のコード・要求・資料が変わったら担当者がnoteで変更を記録し再評価する。実装CLIの起動をシステム全体で禁止する機構ではない。

スキル本文は`skills/scoping`に置き、リポジトリ内の`.agents/skills/scoping`から相対symlinkで参照する。呼び出し方は[README](../../../README.md#要求整理とissue作成)を参照する。グローバルインストールは不要。CLIの検証成功と、担当者がスキルを使って要求を精緻化できたかは分けて確認する。

repository.txtは共有するGit管理ディレクトリを記録する。checkoutパスが保存されている場合も、そのパスが存在し同じGit管理ディレクトリに解決できれば再利用できる。存在しないパスや保存庫の移転は自動修復しない。

## 既存記録からの再開

質問管理のquestionフィールドを持つ既存セッションは受け付けない。既存ファイルを保持し、根拠・決定・未解決事項を確認して新しいtaskへ必要な参照をnoteで渡す。未回答の選択は未決定のまま扱い、新しい評価を行う。旧評価をコピーしたり、旧ファイルのフィールドだけ削除して通過させたりしない。
