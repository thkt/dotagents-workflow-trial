#!/bin/sh
# Runs the probe set against each PR head, one after another (the server port is fixed).
# Usage: probe.sh <acc directory> <pr number>...
acc=$1
shift
for n in "$@"; do
  dir="$acc/pr-$n/trial"
  cp "$acc/zz-probe.spec.js" "$dir/tests/zz-probe.spec.js"
  (cd "$dir" && PLAYWRIGHT_BROWSERS_PATH=0 PLAYWRIGHT_JSON_OUTPUT_NAME="$acc/probe-$n.json" \
    node_modules/.bin/playwright test tests/zz-probe.spec.js --project=desktop --reporter=json > "$acc/probe-$n.log" 2>&1)
  echo "pr $n exit $?"
done
