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
  "criteriaFile": "/absolute/path/to/skills/clarify-requirements/references/criteria.json",
  "request": "絞り込み後に元の一覧へ戻す操作を分かりやすくしたい"
}
```

```sh
bun scripts/discovery.ts start /absolute/path/config.json
```

出力したSESSIONを以降のコマンドへ渡す。同じtaskの開始は上書きせず失敗する。contextDirは正規化したcheckoutに紐づくため、別のcheckoutには別の保存先を指定する。別checkoutの過去記録を参照する場合は、対象と公開範囲を確認して明示的に選ぶ。

criteriaFileはIDをキー、問いを非空文字列とするJSONオブジェクト。開始時の全文を保持するので、元ファイルの変更で実行中の基準は変わらない。referencePathsは参照候補であり、存在・内容・十分性をCLIが検証したという意味ではない。外部資料のURL・版と選択理由はnoteに残す。

## 操作

| 操作 | 入力・結果 |
| --- | --- |
| `status SESSION` | 依頼、基準、revision、根拠、評価、質問・回答の履歴を表示する |
| `note SESSION NOTES.md` | 根拠や作業メモを保存する。旧評価を無効にする |
| `assess SESSION ASSESSMENT.json` | 現在のrevisionと全基準への評価を保存する |
| `answer SESSION ANSWER.json` | 質問IDに対応する回答を保存する。旧評価を無効にする |
| `gate SESSION` | 未評価・不足・回答待ちなら終了1、充足なら次の判断を表示して終了0 |
| `archive SESSION REPORT.md` | gateが通る場合だけ完了した調査記録をresearchへ保存する。同じセッション版・本文の再保存は同じファイルを返す |

start・note・assess・answer・archiveの終了0は保存成功を示す。assessが不足を保存した場合も0であり、進行の判定には必ずgateを使う。エラー時は非zero。statusは読み取りのみ。gateは更新との競合を防ぐため一時lockを使うが、保存済みの評価は変更しない。

以下は説明用に基準がpurposeの1項目だけの場合の評価例。実際にはセッションの全IDをchecksへ含める。未評価の項目を省略しない。

```json
{
  "revision": 0,
  "decision": "一覧復帰のUI方針を選ぶ",
  "checks": {
    "purpose": { "status": "missing", "reason": "元の一覧に戻した後の期待が未確定" }
  },
  "next": "UI実装を保留する。回答で復帰後の期待を確認してから方針を再評価する",
  "question": "一覧へ戻した後も、検索欄ですぐに入力を続けたいですか？"
}
```

人への質問がなければquestionは省略する。例えば調査で解消できるmissingはnextに調査先と再開条件を示す。questionを保存した場合は、回答を保存するまで新しい評価は受け付けない。独立した調査メモはnoteで保存できるが、保留中の質問は解除しない。

```json
{ "questionId": "statusに表示された質問ID", "text": "検索欄ですぐに入力を続けたい" }
```

questionIdはstatusのquestion.idを使う。古いID・重複回答は拒否する。回答後にstatusの新しいrevisionで再評価する。回答文の意味や発言者の真正性はCLIで判定しない。回答の原文と実際の会話の対応は担当者が確認する。

## 保存と制約

contextDirのwork/task/state.jsonがセッション記録の正本。調査記録はresearch内のMarkdownへ保存し、セッションとrevisionを付ける。出典・確認日・適用範囲・未確認事項はREPORT.mdに含める。要求合意の正本はGitHub Issueであり、state.jsonはその代替ではない。

CLIは対象checkout内への保存、別checkoutによるcontextDirの再利用、既存taskの上書きを拒否する。更新はlockと一時ファイルからの置換を使う。ロックやstate.json.tmpが残った場合は自動で削除・再開せず、実行中のプロセスと保存済み内容を照合してから対応する。

信頼する担当者が操作する単一ホスト用。悪意ある同一ユーザーによる保存ファイルの改変、外部資料の変更検出、全ディスク障害への耐久性は保証しない。gateは保存時の評価を返すため、外部のコード・要求・資料が変わったら担当者がnoteで変更を記録し再評価する。実装CLIの起動をシステム全体で禁止する機構ではない。

スキル・CLIの配置は試行リポジトリ内。スキルのグローバルインストールや自動検出の設定は行わない。試行ではSKILL.mdを明示的に読み、そこからコマンドを使える。スキルによる実モデル動作は別の上限付き試行で検証する。
