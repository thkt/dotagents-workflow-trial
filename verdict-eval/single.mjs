// Asks a headless session for the verdict on one policy step, given a version of sufficiency.md and fixed facts
// about the target repo.
// Usage: node single.mjs <sufficiency.md> <DEVELOPMENT.md of the trial repo> <label> <n>
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [file, development, label, count] = process.argv.slice(2);
// The text from one heading up to the next heading of the same level.
const section = (text, heading) => {
  const from = text.indexOf(heading);
  const next = text.indexOf("\n## ", from + heading.length);
  return text.slice(from, next === -1 ? undefined : next);
};
const rules = readFileSync(file, "utf8");
const policy = section(readFileSync(development, "utf8"), "## Issue・PR・文書の日本語確認");
const prompt = `You are in the middle of /scoping for a change that edits README.md and will be published as a pull request by the /implement workflow.

This is the reference you follow, in full:

<sufficiency>
${rules}
</sufficiency>

Facts you have confirmed about the target repo:

- The committed .dotagents.json has "check": ["bun", "run", "check"]. That script runs lint, format check, complexity, type check, control tests, and Playwright E2E. Nothing in it calls Gemini or Codex.
- "capture" runs trial/capture.spec.js and stores media. "ciChecks" are "checks" and "verify"; both run the same check script.
- \`command -v agy\` prints /opt/homebrew/bin/agy and \`command -v codex\` prints a path. The shared procedure document that the policy points to exists and describes how to run the Japanese check.
- DEVELOPMENT.md, section "Issue・PR・文書の日本語確認", says:

<policy>
${policy}
</policy>

Give the verdict for this one step: "README の変更と PR 本文の Gemini 確認と Codex による意味の確認".

Answer with one JSON object on one line and nothing else: {"verdict": "<the verdict you write in the Issue's steps table>", "handling": "<what you write in the handling column, or what you ask the human>", "reason": "<one sentence>"}`;

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
writeFileSync(join(here, `out-single-${label}.json`), JSON.stringify(results, null, 2));
for (const r of results) console.log(`${label} #${r.i} $${r.cost.toFixed(3)} ${r.text.replace(/\s+/g, " ").slice(0, 420)}`);
