// Same-rubric judgement of two finished PRs before the bench completes.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
const task = JSON.parse(await readFile(new URL("./tasks.json", import.meta.url), "utf8"))[0];
const sh = (c, a) => new Promise((res) => { const p = spawn(c, a, { stdio: ["ignore", "pipe", "pipe"] }); let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("close", () => res(o)); });
const R = "thkt/dotagents-workflow-trial";
for (const [arm, pr, issue] of [["ported", 114, 113], ["existing", 119, 118]]) {
  const p = JSON.parse(await sh("gh", ["pr", "view", String(pr), "--repo", R, "--json", "isDraft,additions,deletions,files,statusCheckRollup,body"]));
  const i = JSON.parse(await sh("gh", ["issue", "view", String(issue), "--repo", R, "--json", "body"]));
  const prompt = `PR #${pr} (${R}) の diff を \`gh pr diff ${pr} --repo ${R}\` で読み、次の受け入れ条件を 1 件ずつ満たすか判定してください。コードとテストの内容から判定し、PR 本文の主張だけで満たすとしないでください。出力は JSON のみ: {"met":[true/false,...],"reasons":["..."],"scope_creep":["要求に無い変更"]}\n\n` + task.acceptance.map((a, k) => `${k + 1}. ${a}`).join("\n");
  const out = await sh("claude", ["--print", "--output-format", "json", "--model", "opus", "--allowedTools", "Bash(gh pr diff:*),Bash(gh pr view:*)", "--max-turns", "20", "-p", prompt]);
  let rub; try { const t = JSON.parse(out).result; rub = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); } catch { rub = { error: out.slice(-300) }; }
  console.log(JSON.stringify({ arm, pr, draft: p.isDraft, add: p.additions, del: p.deletions, files: p.files.map((f) => f.path), ci: p.statusCheckRollup.map((c) => `${c.name}:${c.conclusion ?? c.state}`), issue_sections: (i.body.match(/^## .+$/gm) || []).join(" | "), issue_len: i.body.length, pr_body_len: p.body.length, rubric: rub }, null, 1));
}
