# フロー比較 bench

要求文から draft PR までを headless の claude で走らせ、フローごとの到達率・人の判断の回数・時間・費用を比べる。

main に置くと各 run の clone に `tasks.json` の受け入れ条件が入るため、この orphan branch `bench` に置く。run の clone は `origin/main` に reset するので、この branch は run から見えない。

## 実行

```sh
git clone https://github.com/thkt/dotagents-workflow-trial.git trial
node run.mjs --runs 3 --parallel 2 --tasks T1-highlight --arms existing,workflow
node judge.mjs
node report.mjs
```

- `run.mjs` は (task, arm, n) ごとに `trial/` を clone し、stage1（要求 → Issue）と stage2（Issue → draft PR）を 1 つずつの headless session で走らせる。終わった run は Issue と PR を close する。
- `live.mjs` は stream-json で session を開いたまま保ち、background の Workflow の完了通知を同じ session で受ける。
- 期待する URL を出さずに turn が終わり、background task も残っていなければ、その result を人への質問として `runs/<run>/question-<stage>-<k>.md` に書き、ログに `QUESTION <path>` を出す。人が同じ場所の `answer-<stage>-<k>.md` に書いた返答を、そのまま session へ送る。中継した回数を人の判断として数える。返答が `__stop__` ならその stage を打ち切る。
- background task が残っている間の result は途中経過として中継しない。task の完了通知が次の turn を始める。task の有無は stream の `background_tasks_changed` で追う。
- 出力が `hang_minutes`（90 分）届かなければ打ち切る。
- `report.mjs` の wall は、人の返答を待った時間を引いて数える。
- nested session は sandbox を切って走る。Playwright の web server が listen socket を使い、sandbox がそれを拒むため。
- 結果は `runs/`（git 管理外）に出る。残したい結果は `results/` に置く。

## arms

| arm | stage1 | stage2 |
| --- | --- | --- |
| `existing` | `/think` → `/issue` → `/qualify` | build workflow |
| `ported` | `/scoping` | `/implement`（skill 版。2026-09 前半の計測） |
| `workflow` | `/scoping` | `/implement`（implement workflow の起動役。dotclaude PR #760 以降） |

## これまでの結果

旧 skill 版の `ported` と `existing` の比較（各 3 回）。

| task | 指標 | existing | ported |
| --- | --- | --- | --- |
| T1-highlight | 受け入れ条件 | 0.87 | 1 |
| T1-highlight | wall（分） | 46.98 | 38.88 |
| T1-highlight | cost（USD） | 10.11 | 9.81 |
| T2-code-order | PR 到達 | 0.67 | 1 |
| T2-code-order | 受け入れ条件 | 0.90 | 1 |
| T2-code-order | wall（分） | 56.62 | 44.91 |
| T2-code-order | cost（USD） | 10.96 | 10.73 |

この表は定型の返答で進めた旧方式の値で、人の返答を中継する今の方式の値とは比べられない。wall には 20 分の無出力待ちが含まれる。turns は最後の round の `num_turns` だけを数えた値なので、表から外した。arm を比べるには、同じ方式で `existing` も走らせ直す。

`workflow` は T1 を旧方式で 1 回だけ試した（`results/T1-highlight-workflow-1.json`）。PR には届かず、108 分で打ち切った。止まった理由は 2 つある。1 つは、仮説の採用が会話にしかなく Issue に無かったこと。もう 1 つは、Issue が `capture.required: false` を「媒体を更新しない」と読んでいたこと。後者は dotclaude PR #764 で /scoping 側を直した。

## 既知の問題

- `human-decision-required` で止まった後の再起動には、前回の worktree と branch の削除が要る。nested session ではその削除が許可確認で止まるので、人の返答で扱いを決める。
- nested session は live の `~/.claude` の skill を読む。skill の修正を測るには、その修正が live の checkout に入っている必要がある。
