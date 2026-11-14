// Mean wall time of a command over N runs, for comparing node and bun on the repo's own scripts.
// Usage: node runtime-bench.mjs <runs> -- <label>=<command> ...
import { spawnSync } from "node:child_process";

const [runsArg, , ...specs] = process.argv.slice(2);
const runs = Number(runsArg);
for (const spec of specs) {
  const at = spec.indexOf("=");
  const [label, command] = [spec.slice(0, at), spec.slice(at + 1)];
  const argv = command.split(" ");
  const times = [];
  for (let i = 0; i < runs + 3; i += 1) {
    const start = process.hrtime.bigint();
    spawnSync(argv[0], argv.slice(1), { stdio: "ignore" });
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (i >= 3) times.push(ms); // the first three runs warm the file cache
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`${label.padEnd(34)} mean ${mean.toFixed(1)} ms  median ${times[Math.floor(times.length / 2)].toFixed(1)} ms`);
}
