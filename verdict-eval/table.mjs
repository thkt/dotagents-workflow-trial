// Asks a headless session for the whole steps table of one change, given a version of sufficiency.md, the trial
// repo's development policy in full, and fixed facts.
// Usage: node table.mjs <sufficiency.md> <DEVELOPMENT.md of the trial repo> <label> <n>
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [file, development, label, count] = process.argv.slice(2);
const rules = readFileSync(file, "utf8");
const policy = readFileSync(development, "utf8");
const prompt = `You are in the middle of /scoping in the trial repo. The request: add "商品コード：昇順" to the order select of the product list, save and restore the choice with localStorage like the existing orders, and update README.md and the Playwright e2e tests. The /implement workflow will implement it and publish a pull request.

This is the reference you follow, in full:

<sufficiency>
${rules}
</sufficiency>

Facts you have confirmed about the target repo:

- The committed .dotagents.json has "check": ["bun", "run", "check"]. That script runs lint, format check, complexity, type check, control tests, and Playwright E2E. Nothing in it calls Gemini or Codex.
- "capture" runs trial/capture.spec.js, with "required": false. "ciChecks" are "checks" and "verify"; both run the same check script.
- \`command -v agy\` prints /opt/homebrew/bin/agy and \`command -v codex\` prints a path. The shared procedure document that the policy points to exists and describes how to run the Japanese check.
- README.md says the keyboard operation of the desktop standard select is confirmed in a real browser as a supplement.
- This is DEVELOPMENT.md in full:

<development>
${policy}
</development>

Write the list of steps that the README and the development policy impose on this change, with the verdict and the handling for each, as you will show it to the human and write it into the Issue.

Answer with one JSON array on one line and nothing else: [{"step": "...", "verdict": "...", "handling": "..."}]`;

// An empty directory, so the session finds no project files to read.
const cwd = mkdtempSync(join(tmpdir(), "verdict-eval-"));

const one = (i) =>
  new Promise((resolve) => {
    const args = ["--print", "--output-format", "json", "--model", "opus", "--max-turns", "1", "--settings", JSON.stringify({ sandbox: { enabled: false } }), "-p", prompt];
    const child = spawn("claude", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (c) => (out += c));
    child.on("close", () => {
      let parsed = {};
      try {
        parsed = JSON.parse(out);
      } catch {}
      resolve({ i, text: parsed.result ?? out.slice(0, 500), cost: parsed.total_cost_usd ?? 0 });
    });
  });

const n = Number(count);
const results = [];
for (let start = 0; start < n; start += 4) {
  const batch = Array.from({ length: Math.min(4, n - start) }, (_, k) => one(start + k));
  results.push(...(await Promise.all(batch)));
}
writeFileSync(join(here, `out-table-${label}.json`), JSON.stringify(results, null, 2));
for (const r of results) {
  let rows = [];
  try {
    rows = JSON.parse(r.text.slice(r.text.indexOf("["), r.text.lastIndexOf("]") + 1));
  } catch {}
  const hits = rows.filter((row) => /Gemini|日本語/.test(row.step));
  console.log(`${label} #${r.i} $${r.cost.toFixed(3)} rows=${rows.length}`);
  for (const row of hits) console.log(`   ${row.step.slice(0, 70)} | ${row.verdict.slice(0, 90)} | ${row.handling.slice(0, 110)}`);
}
