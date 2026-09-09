import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, lstat, readlink, rm } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const digest = value => createHash('sha256').update(value).digest('hex');
const positive = value => Number.isFinite(value) && value > 0;

async function save(path, value) {
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2));
  await rename(`${path}.tmp`, path);
}

// A process group includes tools launched by the actor, not just its CLI parent.
async function command(argv, cwd, input, timeoutMs, files) {
  let stdout = '', stderr = '', timedOut = false;
  const start = performance.now();
  const child = spawn(argv[0], argv.slice(1), { cwd, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.on('error', () => {});
  child.stdin.end(input);
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  const timer = setTimeout(() => {
    timedOut = true;
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ }
  }, timeoutMs);
  const result = await new Promise(resolveResult => {
    child.on('error', error => resolveResult({ code: null, error: error.message }));
    child.on('close', (code, signal) => resolveResult({ code, signal }));
  });
  clearTimeout(timer);
  if (files) {
    await writeFile(`${files}.stdout`, stdout);
    await writeFile(`${files}.stderr`, stderr);
  }
  return { ...result, stdout, stderr, timedOut, ms: performance.now() - start };
}

async function snapshot(cwd) {
  const list = await command(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd, '', 10000);
  if (list.code !== 0) throw Error('Cannot identify source files');
  const entries = [];
  for (const name of [...new Set(list.stdout.split('\0').filter(Boolean))].sort()) {
    const path = resolve(cwd, name);
    try {
      const stat = await lstat(path);
      const bytes = stat.isSymbolicLink() ? await readlink(path) : await readFile(path);
      entries.push([name, stat.mode, digest(bytes)]);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      entries.push([name, 'deleted']);
    }
  }
  return digest(JSON.stringify(entries));
}

function validate(config) {
  for (const role of ['issue', 'check', 'repair', 'review']) {
    if (!Array.isArray(config[role]) || !config[role].length || config[role].some(v => typeof v !== 'string')) throw Error(`Invalid ${role} command`);
  }
  for (const key of ['repairLimit', 'reviewLimit']) {
    if (!Number.isInteger(config[key]) || !positive(config[key])) throw Error(`Invalid ${key}`);
  }
  if (!positive(config.modelTimeMs) || !positive(config.checkTimeMs)) throw Error('Invalid time limit');
  const relation = relative(resolve(config.cwd), resolve(config.runDir));
  if (!relation.startsWith('..') && !relation.startsWith('/')) throw Error('Evidence must be outside the worktree');
}

async function readIssue(config) {
  const result = await command(config.issue, config.cwd, '', 30000);
  if (result.code !== 0 || result.timedOut || !result.stdout.trim()) throw Error('Issue unavailable');
  return result.stdout;
}

function parseReview(stdout) {
  const result = JSON.parse(stdout);
  if (!['accepted', 'needs_changes'].includes(result.status) || typeof result.findings !== 'string') throw Error('Invalid review result');
  if (result.status === 'needs_changes' && !result.findings.trim()) throw Error('Missing review findings');
  return result;
}

async function runModel(config, state, role, prompt, persist) {
  const remaining = config.modelTimeMs - state.modelMs;
  if (state[role] >= config[`${role}Limit`] || remaining <= 0) return { stop: 'execution_limit' };
  state[role]++;
  const prefix = resolve(config.runDir, `${role}-${state[role]}`);
  state.active = { role, prefix };
  await persist(); // Reserve before launching. An interrupted reservation is never reset.
  await writeFile(`${prefix}.prompt`, prompt, { flag: 'wx' });
  const result = await command(config[role], config.cwd, prompt, remaining, prefix);
  state.modelMs += result.ms;
  state.active = null;
  state.events.push({ role, source: state.source, code: result.code, timedOut: result.timedOut, ms: result.ms, prefix });
  await persist();
  if (result.timedOut) return { stop: 'execution_limit' };
  if (result.code !== 0) return { stop: `${role}_failed` };
  return result;
}

async function cycle(config, state, issue, persist) {
  if (digest(await readIssue(config)) !== state.issueHash) return 'requirements_changed';
  state.source = await snapshot(config.cwd);
  const prefix = resolve(config.runDir, `check-${++state.checks}`);
  state.active = { role: 'check', prefix };
  await persist();
  const checked = await command(config.check, config.cwd, '', config.checkTimeMs, prefix);
  state.active = null;
  state.events.push({ role: 'check', source: state.source, code: checked.code, timedOut: checked.timedOut, prefix });
  await persist();
  const changed = await targetChange(config, state);
  if (changed) return changed;
  if (checked.timedOut || checked.code === null) return 'check_unavailable';
  let findings = `check failed. Read ${prefix}.stdout and ${prefix}.stderr.\n${checked.stdout}\n${checked.stderr}`;
  if (checked.code === 0) {
    const reviewed = await runModel(config, state, 'review', `Independently inspect requirements, code, meaningful tests and required documentation. Do not edit files or run check; its host-side result is exit 0. Do not trust implementation claims. Return JSON {"status":"accepted"|"needs_changes","findings":"concrete unmet conditions or review summary"}.\nRequirements:\n${issue}`, persist);
    if (reviewed.stop) return reviewed.stop;
    const changed = await targetChange(config, state);
    if (changed) return changed;
    let review;
    try { review = parseReview(reviewed.stdout); } catch { return 'invalid_review'; }
    if (review.status === 'accepted') return 'ready_for_human_review';
    findings = review.findings;
  }
  const repaired = await runModel(config, state, 'repair', `Repair only within these agreed requirements. Read the current files and fix the root cause. Do not weaken tests or acceptance criteria. Do not commit, push or publish. The host will run check and an independent review after your changes. Return JSON with status repaired or needs_human, and findings explaining your changes or the necessary human decision. If requirements, permissions or execution limits must change, report needs_human without changing them.\nRequirements:\n${issue}\nFailure evidence:\n${findings}`, persist);
  if (repaired.stop) return repaired.stop;
  return repairOutcome(repaired.stdout);
}

function repairOutcome(stdout) {
  let value;
  try { value = JSON.parse(stdout); } catch { return 'invalid_repair'; }
  if (!['repaired', 'needs_human'].includes(value.status) || typeof value.findings !== 'string') return 'invalid_repair';
  return value.status === 'needs_human' ? 'human_decision_required' : null;
}

async function targetChange(config, state) {
  if (digest(await readIssue(config)) !== state.issueHash) return 'requirements_changed';
  if (await snapshot(config.cwd) !== state.source) return 'source_changed';
  return null;
}

export async function run(config) {
  validate(config);
  await mkdir(config.runDir, { recursive: true });
  const lock = resolve(config.runDir, 'lock');
  await mkdir(lock); // Existing lock requires reconciliation, never an automatic takeover.
  try { return await execute(config); }
  finally { await rm(lock, { recursive: true }); }
}

async function execute(config) {
  const path = resolve(config.runDir, 'state.json');
  let state;
  try { state = JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const configHash = digest(JSON.stringify(config));
  if (state && state.configHash !== configHash) throw Error('Run configuration changed; do not reset the existing limits');
  if (state?.active) throw Error('Interrupted execution: reconcile existing process and evidence before continuing');
  const issue = await readIssue(config);
  state ??= { configHash, issueHash: digest(issue), repair: 0, review: 0, checks: 0, modelMs: 0, active: null, events: [] };
  const persist = () => save(path, state);
  if (state.result) {
    const unchanged = state.issueHash === digest(issue) && state.source === await snapshot(config.cwd);
    return { ...state, result: unchanged ? state.result : 'target_changed_after_stop' };
  }
  await persist();
  while (!state.result) state.result = await cycle(config, state, issue, persist);
  await persist();
  return state;
}

if (import.meta.main) {
  try {
    const result = await run(JSON.parse(await readFile(process.argv[2], 'utf8')));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.result === 'ready_for_human_review' ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
