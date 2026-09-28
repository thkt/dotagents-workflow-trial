// Aggregate results.json + judged.json into a Markdown report with per-arm means and a
// bootstrap 95% interval for each arm's difference from existing, per task.
// Usage: node report.mjs > report.md
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const results = JSON.parse(await readFile(join(here, "runs", "results.json"), "utf8"));
const judged = JSON.parse(await readFile(join(here, "runs", "judged.json"), "utf8"));
const tasks = JSON.parse(await readFile(join(here, "tasks.json"), "utf8"));
const key = (r) => `${r.task}|${r.arm}|${r.n}`;
const byKey = Object.fromEntries(judged.map((j) => [key(j), j]));

const sum = (rounds, f) => (rounds ?? []).reduce((a, r) => a + (f(r) ?? 0), 0);
const metric = (r) => {
  const j = byKey[key(r)] ?? {};
  const rounds = [...r.stage1.rounds, ...(r.stage2?.rounds ?? [])];
  const met = j.rubric?.met;
  return {
    issue_created: r.stage1.id ? 1 : 0,
    pr_created: r.stage2?.id ? 1 : 0,
    human_decisions: r.stage1.human_decisions + (r.stage2?.human_decisions ?? 0),
    // The human's reply time is theirs, not the flow's.
    wall_min: [r.stage1, r.stage2].reduce((a, s) => a + (s ? (s.wall_ms ?? 0) - (s.human_wait_ms ?? 0) : 0), 0) / 60000,
    cost_usd: (r.stage1.rounds.at(-1)?.cost_usd ?? 0) + (r.stage2?.rounds.at(-1)?.cost_usd ?? 0),
    // num_turns counts one turn run, while total_cost_usd is cumulative for the session.
    turns: sum(rounds, (t) => t.num_turns),
    acceptance_ratio: Array.isArray(met) ? met.filter(Boolean).length / met.length : null,
    ci_success: j.pr ? (j.pr.ci_all_success ? 1 : 0) : null,
    tests_touched: j.pr?.tests_touched ?? null,
    scope_creep: j.rubric?.scope_creep?.length ?? null,
    issue_done_conditions: j.issue ? (j.issue.has_done_conditions ? 1 : 0) : null,
    issue_verification: j.issue ? (j.issue.has_verification ? 1 : 0) : null,
  };
};
const METRICS = Object.keys(metric(results[0]));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt = (x) => (x === null || Number.isNaN(x) ? "-" : Number.isInteger(x) ? String(x) : x.toFixed(2));

const bootstrapDiff = (a, b, iters = 2000) => {
  if (!a.length || !b.length) return null;
  const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
  const diffs = Array.from({ length: iters }, () => {
    const ma = mean(Array.from(a, () => pick(a)));
    const mb = mean(Array.from(b, () => pick(b)));
    return mb - ma;
  }).sort((x, y) => x - y);
  return { point: mean(b) - mean(a), lo: diffs[Math.floor(iters * 0.025)], hi: diffs[Math.floor(iters * 0.975)] };
};

const BASE = "existing";
const others = [...new Set(results.map((r) => r.arm))].filter((arm) => arm !== BASE);
const lines = [`# Flow comparison: ${BASE} vs ${others.join(", ")}`, "", `runs: ${results.length}`, ""];
for (const task of tasks) {
  const rows = results.filter((r) => r.task === task.id);
  const values = Object.fromEntries([BASE, ...others].map((arm) => [arm, rows.filter((r) => r.arm === arm).map(metric)]));
  const header = [BASE, ...others, ...others.map((arm) => `diff (${arm} - ${BASE}) 95%`)];
  lines.push(`## ${task.id}`, "", `| metric | ${header.join(" | ")} |`, `| --- |${" --- |".repeat(header.length)}`);
  for (const m of METRICS) {
    const col = (arm) => values[arm].map((v) => v[m]).filter((x) => x !== null);
    const a = col(BASE);
    const means = [BASE, ...others].map((arm) => `${fmt(mean(col(arm)))} (n=${col(arm).length})`);
    const diffs = others.map((arm) => {
      const d = bootstrapDiff(a, col(arm));
      return d ? `${fmt(d.point)} [${fmt(d.lo)}, ${fmt(d.hi)}]` : "-";
    });
    lines.push(`| ${m} | ${[...means, ...diffs].join(" | ")} |`);
  }
  lines.push("");
}
lines.push("## Reading", "", "An interval that excludes 0 separates the arms on that metric at this run count. One that includes 0 does not, and a larger run count is the only way to narrow it.", "");
console.log(lines.join("\n"));
