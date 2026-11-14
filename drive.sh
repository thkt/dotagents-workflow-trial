#!/bin/zsh
# Runs run.mjs for one task and arm, and answers every stage-1 question with the standard answer below.
# Stage-2 questions are left for a person: read runs/<run>/question-stage2-<k>.md and write answer-stage2-<k>.md.
#
# Usage: drive.sh <task> <arm> <last run number> [stage1only]
cd "$(dirname "$0")"
task=$1
arm=$2
last=$3
log="run-$task-$arm-$last.log"
ANSWER=$'全部推奨どおりでお願いします。\n\n決まったことと、手順と判定の表は、すべて Issue の本文に書いてください。\n\nIssue を作成したら、最終行にその URL を書いてください。'

extra=()
[ "$4" = "stage1only" ] && extra=(--stage1only 1)
node run.mjs --runs "$last" --parallel 1 --tasks "$task" --arms "$arm" "${extra[@]}" > "$log" 2>&1 &
pid=$!
while kill -0 $pid 2>/dev/null; do
  for question in runs/$task-$arm-*/question-stage1-*.md(N); do
    answer="${question/question-/answer-}"
    [ -s "$answer" ] || { print -r -- "$ANSWER" > "$answer"; echo "answered $question"; }
  done
  sleep 5
done
wait $pid
cat "$log"
