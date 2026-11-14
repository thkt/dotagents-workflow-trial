// Per-agent cost of the relays in two runs, by label group.
// Usage: node relay-compare.mjs <workflow dir of run A> <workflow dir of run B>
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const read = (dir) => {
  const rows = [];
  for (const f of readdirSync(dir).filter((f) => /^agent-.*\.jsonl$/.test(f))) {
    const meta = JSON.parse(readFileSync(join(dir, f.replace(/\.jsonl$/, ".meta.json")), "utf8"));
    const seen = new Set();
    const row = { label: meta.description, model: "", out: 0, cacheW: 0, turns: 0, tools: 0, first: 0, last: 0 };
    for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
      if (!line) continue;
      let e; try { e = JSON.parse(line); } catch { continue; }
      const at = Date.parse(e.timestamp ?? ""); if (at) { row.first ||= at; row.last = at; }
      const m = e.message;
      if (e.type !== "assistant" || !m) continue;
      row.tools += (m.content ?? []).filter((p) => p.type === "tool_use" && p.name === "Bash").length;
      if (!m.usage || seen.has(m.id)) continue;
      seen.add(m.id);
      row.model = (m.model ?? row.model).replace("claude-", "").replace(/-\d.*$/, "");
      row.turns += 1; row.out += m.usage.output_tokens ?? 0; row.cacheW += m.usage.cache_creation_input_tokens ?? 0;
    }
    rows.push({ ...row, sec: (row.last - row.first) / 1000 });
  }
  return rows;
};
const group = (label) => String(label).replace(/:replay$/, "+replay").replace(/[:#].*$/, "");
const summarize = (rows) => {
  const relays = rows.filter((r) => r.model === "haiku" || r.model === "sonnet");
  const by = new Map();
  for (const r of relays) {
    const g = by.get(group(r.label)) ?? { n: 0, out: 0, sec: 0, bash: 0, cacheW: 0 };
    g.n += 1; g.out += r.out; g.sec += r.sec; g.bash += r.tools; g.cacheW += r.cacheW;
    by.set(group(r.label), g);
  }
  const total = relays.reduce((a, r) => ({ n: a.n + 1, out: a.out + r.out, sec: a.sec + r.sec, bash: a.bash + r.tools, cacheW: a.cacheW + r.cacheW }), { n: 0, out: 0, sec: 0, bash: 0, cacheW: 0 });
  const llm = rows.filter((r) => r.model === "opus").reduce((a, r) => ({ n: a.n + 1, out: a.out + r.out, sec: a.sec + r.sec }), { n: 0, out: 0, sec: 0 });
  return { by, total, llm };
};
const [a, b] = process.argv.slice(2).map((d) => summarize(read(d)));
const keys = [...new Set([...a.by.keys(), ...b.by.keys()])].sort();
const per = (g) => (g ? `${String(g.n).padStart(2)}x out/agent ${String(Math.round(g.out / g.n)).padStart(5)} sec/agent ${(g.sec / g.n).toFixed(0).padStart(3)} bash/agent ${(g.bash / g.n).toFixed(1)}` : "-".padEnd(48));
for (const k of keys) console.log(k.padEnd(16), "| A", per(a.by.get(k)), "| B", per(b.by.get(k)));
for (const [name, s] of [["A", a], ["B", b]]) console.log(`${name} relays: n=${s.total.n} out=${s.total.out} (${Math.round(s.total.out / s.total.n)}/agent) sec=${Math.round(s.total.sec)} (${(s.total.sec / s.total.n).toFixed(1)}/agent) bash=${s.total.bash} cacheW=${s.total.cacheW} | opus agents n=${s.llm.n} out=${s.llm.out} sec=${Math.round(s.llm.sec)}`);
