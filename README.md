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
- `--stage1only 1` を付けると、stage1（要求 → Issue）だけを走らせる。`/scoping` の変更だけを測るときに使う。
- `drive.sh <task> <arm> <最後の run 番号> [stage1only]` は、`run.mjs` を走らせながら stage1 の質問に定型の返答を返す。

## arms

| arm | stage1 | stage2 |
| --- | --- | --- |
| `existing` | `/think` → `/issue` → `/qualify` | build workflow |
| `ported` | `/scoping` | `/implement`（skill 版。2026-09 前半の計測） |
| `workflow` | `/scoping` | `/implement`（implement workflow の起動役。dotclaude PR #760 以降） |
| `host` | `/scoping` | session を立てず、`claude-run.ts` で implement workflow を直接実行する |

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

## T2 の比較（2026-11-14）

同じ方式（人の返答を中継する）で、`existing` を 2 回、`workflow` を 10 回走らせた。`workflow` の #4〜#9 は stage1 だけの実行である。生の結果は `results/t2/` にある。

| 見たもの | existing #1 | existing #2 | workflow #1 | workflow #2 | workflow #3 | workflow #10 |
| --- | --- | --- | --- | --- | --- | --- |
| PR | なし（`red-failed`） | #205 | #207 | なし（`human-decision-required`） | #210 | #218 |
| 受け入れ条件 | なし | 4/5 | 5/5 | なし | 5/5 | 5/5 |
| 検査（32 件） | なし | 30 | 30 | なし | 30 | 30 |
| 仕込んだ欠陥の検出（15 種類） | なし | 11 | 12 | なし | 14 | 14 |
| 時間（分） | 18.8 | 21.9 | 22.3 | 15.2 | 21.9 | 22.3 |
| 費用（USD） | 5.16 | 6.71 | 11.08 | 7.81 | 9.51 | 11.09 |
| 人の判断 | 0 | 0 | 2 | 2 | 1 | 2 |

- 検査で落ちる 2 件は、比較方式を見分ける対（D05a/b、D06a/b）の片方で、どの実装でも片方は落ちる。
- workflow #2 は dotclaude PR #791 の前、#3 は #791 を入れた状態、#10 は #792 までを入れた `main` で走らせた。
- 2 回目以降の実行は、閉じた過去の Issue を一覧で見られるので、互いに独立ではない。
- `workflow` の stage2 の費用は、起動役の session の費用（`rounds[].cost_usd`）に、host の費用を足した値である。host の費用は `result.json` に入らない。nested session の記録（`~/.claude/projects/<run の repo>/<session>.jsonl`）にある `claude-run: {…"cost_usd":…}` の行から読む。

## 精度の検査（`acc/`）

PR の実装とテストを、要求から書いた検査と、欠陥を仕込んだ参照実装で確かめる。`acc/t1` は T1-highlight、`acc/t2` は T2-code-order 用である。

| ファイル | 役割 |
| --- | --- |
| `zz-probe.spec.js`、`zz-probe-t2.spec.js` | 要求から書いた検査。PR の実装に対して実行する |
| `ref-search.js`、`ref-order.js` | 参照実装。`__MUTANT__` を欠陥の名前に置き換えると、その欠陥が入る |
| `cross.mjs`、`cross-t2.mjs` | PR が変更したテストを、欠陥なしと欠陥 1 つずつの参照実装に対して実行する。欠陥なしで通り、欠陥ありで落ちたテストがあれば、その欠陥を検出したと数える |

E2E のポート 4173 は固定なので、検査と bench の run を同時に走らせない。

```sh
# PR の checkout を作る（N は PR 番号）
git -C trial fetch origin pull/N/head:refs/pr/N
mkdir -p acc/t2/pr-N && git -C trial archive refs/pr/N trial | tar -x -C acc/t2/pr-N
ln -s "$PWD/runs/<依存を導入済みの run>/repo/trial/node_modules" acc/t2/pr-N/trial/node_modules

# 検査を PR の実装に対して実行する
cp acc/t2/zz-probe-t2.spec.js acc/t2/pr-N/trial/tests/
(cd acc/t2/pr-N/trial && PLAYWRIGHT_BROWSERS_PATH=0 node_modules/.bin/playwright test tests/zz-probe-t2.spec.js --project=desktop)

# PR のテストを参照実装と欠陥に対して実行する（結果は acc/t2/cross-N.json）
node acc/t2/cross-t2.mjs "$PWD/acc/t2" "$PWD/trial" N
```

`cross-t2.mjs` に `probe` を渡すと、検査そのものが欠陥を検出するかを確かめる。そのときは `acc/t2/ref/trial` に、`origin/main` の `trial/` を同じ手順で展開し、検査のファイルを `tests/` に置いておく。

## 判定の再現（`verdict-eval/`）

`/scoping` の規定（dotclaude の `skills/scoping/references/sufficiency.md`）と対象 repo の事実を headless の session に渡し、手順の判定だけを繰り返し問う。通しの実行で低い割合で起きた誤りが、規定の文面によるものかを見分けるために使う。

```sh
node verdict-eval/single.mjs <sufficiency.md> trial/DEVELOPMENT.md before 8   # 1 つの手順の判定を問う
node verdict-eval/table.mjs <sufficiency.md> trial/DEVELOPMENT.md before 8    # 手順の一覧を丸ごと作らせる
```

2026-11-14 の `main`（dotclaude 0bb1295f）の文面では、どちらも 8 回中 8 回が「workflow が実行できない」だった（`results/t2/verdict-single.json`、`verdict-table.json`）。

## そのほかの道具

| ファイル | 役割 |
| --- | --- |
| `drive.sh` | `run.mjs` を走らせ、stage1 の質問に定型の返答を返す。stage2 の質問は人が答える |
| `weight.mjs` | run ごとの重さ（agent の数、token、時間）を数える |
| `breakdown.mjs` | 1 回の run が token と時間をどの agent に使ったかを、agent ごとに出す |
| `relay-compare.mjs` | 2 つの run の中継の費用を、ラベルの組ごとに比べる |
| `runtime-bench.mjs` | 同じコマンドを N 回実行し、node と bun の時間を比べる |

## 既知の問題

- `human-decision-required` で止まった後の再起動には、前回の worktree と branch の削除が要る。nested session ではその削除が許可確認で止まるので、人の返答で扱いを決める。
- nested session は live の `~/.claude` の skill を読む。skill の修正を測るには、その修正が live の checkout に入っている必要がある。
