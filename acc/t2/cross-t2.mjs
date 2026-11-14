// Cross-test for T2: runs a PR's own changed e2e files against the reference implementation, clean and with
// one seeded defect at a time. A defect counts as caught when a test fails that passed against the clean one.
//
// Usage: node cross-t2.mjs <t2 directory> <clone with refs/pr/N> <pr number | "probe">...
// "probe" runs the probe set against the reference inside <t2>/ref/trial.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [t2, clone, ...targets] = process.argv.slice(2);
const MUTANTS = [
  "no-sort", "code-descending", "no-persist", "no-restore", "restore-select-only", "restore-rows-only", "saves-other-value",
  "original-stuck", "unhides-rows", "search-resets", "clear-resets", "write-throws", "numeric-compare", "prefix-only", "ties-reversed",
];
const template = readFileSync(join(t2, "ref-order.js"), "utf8");

const failing = (dir, files) => {
  const out = join(t2, "cross-last.json");
  spawnSync("node_modules/.bin/playwright", ["test", ...files, "--project=desktop", "--reporter=json"], {
    cwd: dir,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: "0", PLAYWRIGHT_JSON_OUTPUT_NAME: out },
    stdio: "ignore",
  });
  const failed = [];
  let total = 0;
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      total += 1;
      if (!spec.ok) failed.push(`${spec.file} › ${spec.title}`);
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of JSON.parse(readFileSync(out, "utf8")).suites ?? []) walk(suite);
  return { failed, total };
};

for (const target of targets) {
  const probe = target === "probe";
  const dir = join(t2, probe ? "ref" : `pr-${target}`, "trial");
  const live = join(dir, "public", "search.js");
  const own = join(dir, "public", "search.own.js");
  if (!existsSync(own)) copyFileSync(live, own);
  let files = ["tests/zz-probe-t2.spec.js"];
  if (!probe) {
    const base = spawnSync("git", ["merge-base", "origin/main", `refs/pr/${target}`], { cwd: clone, encoding: "utf8" }).stdout.trim();
    files = spawnSync("git", ["diff", "--name-only", base, `refs/pr/${target}`, "--", "trial/tests"], { cwd: clone, encoding: "utf8" })
      .stdout.trim().split("\n").filter(Boolean).map((path) => path.replace(/^trial\//, ""));
  }
  const entry = { files, own: null, base: null, caught: {}, missed: [] };
  try {
    copyFileSync(own, live);
    entry.own = failing(dir, files);
    writeFileSync(live, template.replaceAll("__MUTANT__", "none"));
    entry.base = failing(dir, files);
    for (const mutant of MUTANTS) {
      writeFileSync(live, template.replaceAll("__MUTANT__", mutant));
      const fresh = failing(dir, files).failed.filter((title) => !entry.base.failed.includes(title));
      if (fresh.length) entry.caught[mutant] = fresh.length;
      else entry.missed.push(mutant);
    }
  } finally {
    copyFileSync(own, live);
  }
  console.log(`${target} files=${files.join(",")} own_failed=${entry.own.failed.length}/${entry.own.total} base_failed=${entry.base.failed.length} caught=${Object.keys(entry.caught).length}/${MUTANTS.length} missed=${entry.missed.join(",")}`);
  if (entry.base.failed.length) console.log(`  base failed: ${entry.base.failed.join(" | ")}`);
  writeFileSync(join(t2, `cross-${target}.json`), JSON.stringify(entry, null, 1));
}
