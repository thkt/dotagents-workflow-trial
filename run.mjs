// Flow comparison runner: existing (/think -> /issue -> /qualify -> build) vs ported (/scoping -> /implement).
// Each (task, arm, n) gets a fresh clone of the trial repo and two headless claude sessions
// (stage1: request -> Issue, stage2: Issue -> draft PR). A turn that ends on the human without
// the expected URL is relayed to the human through runs/<run>/question-<k>.md, and the
// answer written to answer-<k>.md goes back verbatim; each relay counts as one human decision.
// An answer of __stop__ ends that stage.
//
// Usage: node run.mjs --runs 5 --parallel 2 [--tasks T1-highlight,T2-code-order] [--arms existing,ported]
import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { live } from "./live.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1]] : [])).filter((p) => p.length),
);
const RUNS = Number(args.runs ?? 5);
const PARALLEL = Number(args.parallel ?? 2);
const tasks = JSON.parse(await readFile(join(here, "tasks.json"), "utf8")).filter(
  (t) => !args.tasks || args.tasks.split(",").includes(t.id),
);
const arms = JSON.parse(await readFile(join(here, "arms.json"), "utf8"));
const ARM_NAMES = (args.arms ?? "existing,ported").split(",");
const REPO_URL = "https://github.com/thkt/dotagents-workflow-trial.git";
const ISSUE_RE = /github\.com\/thkt\/dotagents-workflow-trial\/issues\/(\d+)/;
const PR_RE = /github\.com\/thkt\/dotagents-workflow-trial\/pull\/(\d+)/;
const STOPPED_RE = /stopped:\S+/;
// The nested sessions run without the Bash sandbox: Playwright's web server needs a listening
// socket and the sandbox refuses it, which made build's test gates fail on every unit.
const NESTED_SETTINGS = ["--settings", JSON.stringify({ sandbox: { enabled: false } })];
const TOOLS = "Bash,Read,Write,Edit,MultiEdit,Glob,Grep,LS,Agent,Skill,Workflow,TodoWrite,WebFetch";

const sh = (cmd, cmdArgs, cwd) =>
  new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (c) => (out += c));
    child.stderr.on("data", (c) => (err += c));
    child.on("close", (code) => resolve({ code, out, err }));
  });

// Relay a question to the human: write it, print one QUESTION line for whoever watches the
// log, and wait until the answer file appears.
const asker = (dir, label) => async (text, k) => {
  const q = join(dir, `question-${label}-${k}.md`);
  const a = join(dir, `answer-${label}-${k}.md`);
  await writeFile(q, text);
  console.log(`QUESTION ${q}`);
  for (;;) {
    const ready = await stat(a).then((s) => s.size > 0, () => false);
    if (ready) return readFile(a, "utf8");
    await sleep(5000);
  }
};

// Drive one stage in a single live session. The session stays open so background work
// (the build or implement workflow, background agents) can notify the model.
const stage = async (prompt, cwd, want, ask) => {
  const r = await live({ prompt, cwd, want: new RegExp(want.source + "|" + STOPPED_RE.source), ask, hangMs: arms.hang_minutes * 60000, tools: TOOLS, extraArgs: NESTED_SETTINGS });
  const m = r.match ? r.match.match(want) : null;
  return { rounds: r.turns, session_id: r.session_id, why: r.why, wall_ms: r.wall_ms, human_wait_ms: r.human_wait_ms, match: r.match, id: m?.[1] ?? null, human_decisions: r.human_decisions };
};

const one = async (task, arm, n) => {
  const dir = join(here, "runs", `${task.id}-${arm}-${n}`);
  const repo = join(dir, "repo");
  const resultPath = join(dir, "result.json");
  if (existsSync(resultPath)) return JSON.parse(await readFile(resultPath, "utf8"));
  await mkdir(dir, { recursive: true });
  if (!existsSync(repo)) {
    await sh("git", ["clone", "--quiet", join(here, "trial"), repo]);
    await sh("git", ["remote", "set-url", "origin", REPO_URL], repo);
    await sh("git", ["fetch", "--quiet", "origin", "main"], repo);
    await sh("git", ["reset", "--hard", "--quiet", "origin/main"], repo);
    // Environment prep from the repo's own .dotagents.json setup (deps + Chromium), run once
    // per clone by the runner so neither arm pays for it or fails on it.
    const cfg = JSON.parse(await readFile(join(repo, ".dotagents.json"), "utf8"));
    for (const [cmd, ...cmdArgs] of cfg.setup ?? []) {
      const p = await sh(cmd, cmdArgs, repo);
      if (p.code !== 0) await writeFile(join(dir, "setup-failure.log"), `${cmd} ${cmdArgs.join(" ")}\n${p.err.slice(-3000)}`);
    }
  }
  const started = new Date().toISOString();
  const s1 = await stage(arms[arm].stage1.replaceAll("{request}", task.request), repo, ISSUE_RE, asker(dir, "stage1"));
  let s2 = null;
  if (s1.id) {
    const p = arms[arm].stage2.replaceAll("{issue}", s1.id).replaceAll("{repo}", repo);
    s2 = await stage(p, repo, PR_RE, asker(dir, "stage2"));
  }
  const result = { task: task.id, arm, n, started, finished: new Date().toISOString(), repo, stage1: s1, stage2: s2 };
  await writeFile(resultPath, JSON.stringify(result, null, 2));
  // Close what this run published so the next run's duplicate search does not reuse it.
  // Closed issues and PRs stay readable for judge.mjs.
  if (s2?.id) await sh("gh", ["pr", "close", s2.id, "--repo", "thkt/dotagents-workflow-trial", "--comment", "bench run finished; closed by the runner"]);
  if (s1.id) await sh("gh", ["issue", "close", s1.id, "--repo", "thkt/dotagents-workflow-trial", "--comment", "bench run finished; closed by the runner"]);
  return result;
};

const queue = [];
for (const task of tasks) for (const arm of ARM_NAMES) for (let n = 1; n <= RUNS; n++) queue.push([task, arm, n]);
const results = [];
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    while (queue.length) {
      const [task, arm, n] = queue.shift();
      const r = await one(task, arm, n);
      results.push(r);
      console.log(`${task.id} ${arm} #${n} issue=${r.stage1.id ?? "-"} pr=${r.stage2?.id ?? "-"} decisions=${r.stage1.human_decisions + (r.stage2?.human_decisions ?? 0)}`);
    }
  }),
);
await writeFile(join(here, "runs", "results.json"), JSON.stringify(results, null, 2));
