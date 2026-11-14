// Where one bench run spends its tokens and time: one row per agent, with its label, model,
// token counts, and the wall time between its first and last transcript line.
//
// Usage: node breakdown.mjs runs/<run>/result.json
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const result = JSON.parse(readFileSync(process.argv[2], "utf8"));
const projects = join(homedir(), ".claude", "projects");
const encoded = result.repo.replace(/[^A-Za-z0-9]/g, "-");
const projectDir = readdirSync(projects).find(
  (d) => d === encoded || d.endsWith(encoded.replace(/^-private/, "")),
);
if (!projectDir) throw new Error(`no transcript directory for ${result.repo}`);

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];

// Usage is counted once per message id, since one message spans several transcript lines.
const read = (file) => {
  const seen = new Set();
  const row = { out: 0, cacheW: 0, cacheR: 0, turns: 0, model: "", first: 0, last: 0 };
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const at = Date.parse(entry.timestamp ?? "");
    if (at) {
      row.first ||= at;
      row.last = at;
    }
    const message = entry.message;
    if (entry.type !== "assistant" || !message?.usage || seen.has(message.id)) continue;
    seen.add(message.id);
    row.model = (message.model ?? row.model).replace("claude-", "").replace(/-\d.*$/, "");
    row.turns += 1;
    row.out += message.usage.output_tokens ?? 0;
    row.cacheW += message.usage.cache_creation_input_tokens ?? 0;
    row.cacheR += message.usage.cache_read_input_tokens ?? 0;
  }
  return row;
};

const rows = [];
for (const stage of ["stage1", "stage2"]) {
  const id = result[stage]?.session_id;
  if (!id) continue;
  const main = join(projects, projectDir, `${id}.jsonl`);
  if (existsSync(main)) rows.push({ stage, label: "(main session)", ...read(main) });
  for (const file of walk(join(projects, projectDir, id, "subagents")).filter((f) =>
    /agent-[^/]+\.jsonl$/.test(f),
  )) {
    const metaPath = file.replace(/\.jsonl$/, ".meta.json");
    const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : {};
    rows.push({ stage, label: meta.description ?? meta.agentType ?? "?", ...read(file) });
  }
}

// A label such as check:2 or review:1 belongs to the group check or review.
const group = (label) => label.replace(/[:#].*$/, "").replace(/\s*\d+$/, "");
const groups = new Map();
for (const row of rows) {
  const key = `${row.stage} ${group(row.label)} ${row.model}`;
  const g = groups.get(key) ?? { n: 0, out: 0, cacheW: 0, cacheR: 0, sec: 0 };
  g.n += 1;
  g.out += row.out;
  g.cacheW += row.cacheW;
  g.cacheR += row.cacheR;
  g.sec += Math.round((row.last - row.first) / 1000);
  groups.set(key, g);
}
const total = [...groups.values()].reduce((a, g) => a + g.out, 0);
console.log(`${result.task}-${result.arm}-${result.n}  total out ${total}`);
for (const [key, g] of [...groups.entries()].sort((a, b) => b[1].out - a[1].out))
  console.log(
    `${key.padEnd(44)} n=${String(g.n).padStart(2)} out=${String(g.out).padStart(6)} ${String(Math.round((g.out / total) * 100)).padStart(3)}% cacheW=${String(g.cacheW).padStart(7)} cacheR=${String(g.cacheR).padStart(8)} sec=${String(g.sec).padStart(5)}`,
  );
