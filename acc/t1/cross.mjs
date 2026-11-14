// Cross-test: runs a PR's own e2e files against the reference implementation, clean and with one seeded
// defect at a time. A defect counts as caught when a test fails that passed against the clean reference.
// The clean reference is the one of the four variants (adjacent matches merged or not, fallback or not)
// that fails the fewest of that PR's tests, so a PR is not charged for a decision its Issue took.
//
// Usage: node cross.mjs <acc directory> <clone with refs/pr/N> <pr number | "probe">...
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [acc, clone, ...targets] = process.argv.slice(2);
const MUTANTS = [
  "stale", "empty-keeps", "whitespace-keeps", "no-trim", "query-text", "name-only", "code-only", "first-only",
  "inner-html", "case-sensitive", "no-fullwidth", "sort-drops", "clear-keeps", "td-replaced", "off-by-one",
];
const template = readFileSync(join(acc, "ref-search.js"), "utf8");
const variant = (mutant, merge, fallback) =>
  template.replace("__MUTANT__", mutant).replace("__MERGE__", String(merge)).replace("__FALLBACK__", String(fallback));

const failing = (dir, files) => {
  const out = join(acc, "cross-last.json");
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

const report = {};
for (const target of targets) {
  const probe = target === "probe";
  const dir = join(acc, probe ? "pr-194" : `pr-${target}`, "trial");
  const live = join(dir, "public", "search.js");
  const own = join(dir, "public", "search.own.js");
  if (!existsSync(own)) copyFileSync(live, own);
  let files = ["tests/zz-probe.spec.js"];
  if (!probe) {
    const base = spawnSync("git", ["merge-base", "origin/main", `refs/pr/${target}`], { cwd: clone, encoding: "utf8" }).stdout.trim();
    files = spawnSync("git", ["diff", "--name-only", base, `refs/pr/${target}`, "--", "trial/tests"], { cwd: clone, encoding: "utf8" })
      .stdout.trim().split("\n").filter(Boolean).map((path) => path.replace(/^trial\//, ""));
  }
  const entry = { files, own: null, base: null, caught: {}, missed: [] };
  try {
    copyFileSync(own, live);
    entry.own = failing(dir, files);
    let best = null;
    for (const merge of [false, true]) {
      for (const fallback of [false, true]) {
        writeFileSync(live, variant("none", merge, fallback));
        const run = failing(dir, files);
        if (!best || run.failed.length < best.run.failed.length) best = { merge, fallback, run };
      }
    }
    entry.base = { merge: best.merge, fallback: best.fallback, failed: best.run.failed, total: best.run.total };
    for (const mutant of MUTANTS) {
      writeFileSync(live, variant(mutant, best.merge, best.fallback));
      const fresh = failing(dir, files).failed.filter((title) => !best.run.failed.includes(title));
      if (fresh.length) entry.caught[mutant] = fresh.length;
      else entry.missed.push(mutant);
    }
  } finally {
    copyFileSync(own, live);
  }
  report[target] = entry;
  console.log(`${target} files=${files.join(",")} own_failed=${entry.own.failed.length}/${entry.own.total} base(merge=${entry.base.merge},fallback=${entry.base.fallback}) failed=${entry.base.failed.length} caught=${Object.keys(entry.caught).length}/${MUTANTS.length} missed=${entry.missed.join(",")}`);
  writeFileSync(join(acc, `cross-${target}.json`), JSON.stringify(entry, null, 1));
}
