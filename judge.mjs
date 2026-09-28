// Judge each run's Issue and PR with the same rubric for both arms.
// Deterministic part: Issue sections, PR draft state, CI rollup, files touched, tests added.
// Rubric part: one read-only headless claude session per PR that checks the task's acceptance
// list against the PR diff and returns JSON. The same prompt goes to every run.
//
// Usage: node judge.mjs
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const OWNER_REPO = "thkt/dotagents-workflow-trial";
const tasks = Object.fromEntries(JSON.parse(await readFile(join(here, "tasks.json"), "utf8")).map((t) => [t.id, t]));
const results = JSON.parse(await readFile(join(here, "runs", "results.json"), "utf8"));

const sh = (cmd, args, cwd) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (c) => (out += c));
    child.on("close", (code) => resolve({ code, out }));
  });
const gh = async (args) => JSON.parse((await sh("gh", [...args, "--repo", OWNER_REPO])).out || "null");

const issueShape = (body) => ({
  has_done_conditions: /完了条件|Acceptance|受け入れ/.test(body),
  has_verification: /検証方法|Verification|How to Test/.test(body),
  has_plan_section: /^## Plan/m.test(body),
  has_non_goals: /対象外|Non-goals|やらないこと/.test(body),
  length: body.length,
});

const rubric = async (task, prNumber, cwd) => {
  const prompt = [
    `PR #${prNumber} (${OWNER_REPO}) の diff を \`gh pr diff ${prNumber}\` で読み、次の受け入れ条件を 1 件ずつ満たすかを判定してください。`,
    "コードとテストの内容から判定し、PR 本文の主張だけで満たすとしないでください。",
    "出力は JSON のみ: {\"met\": [true/false, ...], \"reasons\": [\"...\", ...], \"scope_creep\": [\"要求に無い変更\", ...]}。",
    "",
    ...task.acceptance.map((a, i) => `${i + 1}. ${a}`),
  ].join("\n");
  const { out } = await sh(
    "claude",
    ["--print", "--output-format", "json", "--model", "opus", "--allowedTools", "Bash(gh pr diff:*),Bash(gh pr view:*),Read", "--max-turns", "20", "-p", prompt],
    cwd,
  );
  try {
    const j = JSON.parse(out);
    const text = String(j.result ?? "");
    const inner = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    return { ...JSON.parse(inner), cost_usd: j.total_cost_usd };
  } catch {
    return { met: null, error: out.slice(-500) };
  }
};

const judged = [];
for (const r of results) {
  const task = tasks[r.task];
  const entry = { task: r.task, arm: r.arm, n: r.n, issue: null, pr: null, rubric: null };
  if (r.stage1.id) {
    const issue = await gh(["issue", "view", r.stage1.id, "--json", "body,state,title"]);
    entry.issue = { number: Number(r.stage1.id), state: issue?.state, ...issueShape(issue?.body ?? "") };
  }
  if (r.stage2?.id) {
    const pr = await gh(["pr", "view", r.stage2.id, "--json", "isDraft,state,body,files,additions,deletions,statusCheckRollup,closingIssuesReferences"]);
    const files = (pr?.files ?? []).map((f) => f.path);
    const rollup = pr?.statusCheckRollup ?? [];
    entry.pr = {
      number: Number(r.stage2.id),
      is_draft: pr?.isDraft,
      state: pr?.state,
      files,
      additions: pr?.additions,
      deletions: pr?.deletions,
      tests_touched: files.filter((f) => f.startsWith("trial/tests/")).length,
      readme_touched: files.includes("README.md"),
      ci_checks: rollup.length,
      ci_all_success: rollup.length > 0 && rollup.every((c) => (c.conclusion ?? c.state) === "SUCCESS"),
      links_issue: (pr?.closingIssuesReferences ?? []).some((i) => i.number === Number(r.stage1.id)),
      body_has_verification: /Verification|検証|How to Test/.test(pr?.body ?? ""),
    };
    entry.rubric = await rubric(task, r.stage2.id, r.repo);
  }
  judged.push(entry);
  console.log(`${r.task} ${r.arm} #${r.n} pr=${entry.pr?.number ?? "-"} ci=${entry.pr?.ci_all_success ?? "-"} met=${entry.rubric?.met?.filter(Boolean).length ?? "-"}/${task.acceptance.length}`);
}
await writeFile(join(here, "runs", "judged.json"), JSON.stringify(judged, null, 2));
