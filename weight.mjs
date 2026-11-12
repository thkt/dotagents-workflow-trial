// Weight of one bench run: every agent its nested sessions started, with model and tokens.
// Reads the transcripts Claude Code keeps under ~/.claude/projects/<encoded cwd>/<session>/.
//
// Usage: node weight.mjs runs/<run>/result.json [--agents]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const [resultPath, flag] = process.argv.slice(2);
const result = JSON.parse(readFileSync(resultPath, "utf8"));
const projects = join(homedir(), ".claude", "projects");
const encoded = result.repo.replace(/[^A-Za-z0-9]/g, "-");
const projectDir = readdirSync(projects).find((d) => d === encoded || d.endsWith(encoded.replace(/^-private/, "")));
if (!projectDir) throw new Error(`no transcript directory for ${result.repo}`);

// One transcript's assistant usage, counted once per message id (a message spans several lines).
const usageOf = (file) => {
  const seen = new Set();
  const u = { turns: 0, out: 0, inp: 0, cache_read: 0, cache_write: 0, model: "" };
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const m = o.message;
    if (o.type !== "assistant" || !m?.usage || seen.has(m.id)) continue;
    seen.add(m.id);
    u.model = (m.model ?? u.model).replace("claude-", "");
    u.turns += 1;
    u.out += m.usage.output_tokens ?? 0;
    u.inp += m.usage.input_tokens ?? 0;
    u.cache_read += m.usage.cache_read_input_tokens ?? 0;
    u.cache_write += m.usage.cache_creation_input_tokens ?? 0;
  }
  return u;
};

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];

const rows = [];
for (const stage of ["stage1", "stage2"]) {
  const id = result[stage]?.session_id;
  if (!id) continue;
  const main = join(projects, projectDir, `${id}.jsonl`);
  if (existsSync(main)) rows.push({ stage, kind: "main", label: "(main session)", ...usageOf(main) });
  for (const file of walk(join(projects, projectDir, id, "subagents")).filter((f) => /agent-[^/]+\.jsonl$/.test(f))) {
    const metaPath = file.replace(/\.jsonl$/, ".meta.json");
    const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : {};
    rows.push({
      stage,
      kind: file.includes("/workflows/") ? "workflow" : "subagent",
      label: meta.description ?? meta.agentType ?? "?",
      ...usageOf(file),
    });
  }
}

const sum = (list) =>
  list.reduce(
    (a, r) => ({ n: a.n + 1, turns: a.turns + r.turns, out: a.out + r.out, cache_read: a.cache_read + r.cache_read, cache_write: a.cache_write + r.cache_write }),
    { n: 0, turns: 0, out: 0, cache_read: 0, cache_write: 0 },
  );
const agents = rows.filter((r) => r.kind !== "main");
const byModel = {};
for (const r of agents) (byModel[r.model.replace(/-\d.*$/, "")] ??= []).push(r);

if (flag === "--agents")
  for (const r of rows.toSorted((a, b) => b.out - a.out))
    console.log(`${r.stage} ${r.kind.padEnd(8)} ${String(r.label).padEnd(30)} ${r.model.padEnd(12)} turns=${r.turns} out=${r.out} cacheW=${r.cache_write} cacheR=${r.cache_read}`);
console.log(
  JSON.stringify(
    {
      run: `${result.task}-${result.arm}-${result.n}`,
      main_sessions: sum(rows.filter((r) => r.kind === "main")),
      agents: sum(agents),
      agents_by_model: Object.fromEntries(Object.entries(byModel).map(([k, v]) => [k, sum(v)])),
      total: sum(rows),
    },
    null,
    1,
  ),
);
