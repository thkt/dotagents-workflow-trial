import { assertConfig, assertState } from './input.ts';
import type { Config, State, ActorRole, StopReason } from './input.ts';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, lstat, readlink, rm } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  ms: number;
}
type Persist = () => Promise<void>;
type ModelResult = { stdout: string } | { stop: StopReason };
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

async function save(path: string, value: State) {
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2));
  await rename(`${path}.tmp`, path);
}

const interruptionMessage =
  'Interrupted execution: reconcile existing process and evidence before continuing';
let interrupted = false;
let activeGroup: number | undefined;

function killGroup(pid: number | undefined) {
  if (pid === undefined) {
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) {
      throw error;
    }
  }
}

function interrupt() {
  interrupted = true;
  killGroup(activeGroup);
}

function assertRunning() {
  if (interrupted) {
    throw Error(interruptionMessage);
  }
}

// A process group includes tools launched by the actor, not just its CLI parent.
async function command(
  argv: string[],
  cwd: string,
  input: string,
  timeoutMs: number,
  files?: string,
): Promise<CommandResult> {
  assertRunning();
  let stdout = '',
    stderr = '',
    timedOut = false;
  const start = performance.now();
  const [executable, ...args] = argv;
  if (!executable) {
    throw Error('Command executable is required');
  }
  const child = spawn(executable, args, {
    cwd,
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  activeGroup = child.pid;
  child.stdin.on('error', () => {});
  child.stdin.end(input);
  child.stdout.on('data', (data) => {
    stdout += data;
  });
  child.stderr.on('data', (data) => {
    stderr += data;
  });
  const timer = setTimeout(() => {
    timedOut = true;
    killGroup(child.pid);
  }, timeoutMs);
  const code = await new Promise<number | null>((resolveCode) => {
    child.on('error', (error) => {
      stderr += `${error.message}\n`;
      resolveCode(null);
    });
    child.on('close', resolveCode);
  });
  clearTimeout(timer);
  activeGroup = undefined;
  if (files) {
    await writeFile(`${files}.stdout`, stdout);
    await writeFile(`${files}.stderr`, stderr);
  }
  assertRunning(); // Keep the persisted active reservation when interrupted.
  return { code, stdout, stderr, timedOut, ms: performance.now() - start };
}

async function snapshot(cwd: string) {
  const list = await command(
    ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    cwd,
    '',
    10000,
  );
  if (list.code !== 0) {
    throw Error('Cannot identify source files');
  }
  const entries = [];
  for (const name of [...new Set(list.stdout.split('\0').filter(Boolean))].sort()) {
    const path = resolve(cwd, name);
    try {
      const stat = await lstat(path);
      const bytes = stat.isSymbolicLink() ? await readlink(path) : await readFile(path);
      entries.push([name, stat.mode, digest(bytes)]);
    } catch (error) {
      if (!isMissing(error)) {
        throw error;
      }
      entries.push([name, 'deleted']);
    }
  }
  return digest(JSON.stringify(entries));
}

function validate(config: Config) {
  const relation = relative(resolve(config.cwd), resolve(config.runDir));
  if (!relation.startsWith('..') && !relation.startsWith('/')) {
    throw Error('Evidence must be outside the worktree');
  }
}

async function readIssue(config: Config) {
  const result = await command(config.issue, config.cwd, '', 30000);
  if (result.code !== 0 || result.timedOut || !result.stdout.trim()) {
    throw Error('Issue unavailable');
  }
  return result.stdout;
}

function parseReply(stdout: string): { status: string; findings: string } | null {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  if (!('status' in value) || typeof value.status !== 'string') {
    return null;
  }
  if (!('findings' in value) || typeof value.findings !== 'string') {
    return null;
  }
  return { status: value.status, findings: value.findings };
}

function parseReview(stdout: string) {
  const reply = parseReply(stdout);
  if (!reply || !['accepted', 'needs_changes'].includes(reply.status)) {
    return null;
  }
  if (reply.status === 'needs_changes' && !reply.findings.trim()) {
    return null;
  }
  return reply;
}

async function runModel(
  config: Config,
  state: State,
  role: ActorRole,
  prompt: string,
  persist: Persist,
): Promise<ModelResult> {
  const remaining = config.modelTimeMs - state.modelMs;
  if (state[role] >= config[`${role}Limit`] || remaining <= 0) {
    return { stop: 'execution_limit' };
  }
  state[role]++;
  const prefix = resolve(config.runDir, `${role}-${state[role]}`);
  state.active = { role, prefix };
  await persist(); // Reserve before launching. An interrupted reservation is never reset.
  await writeFile(`${prefix}.prompt`, prompt, { flag: 'wx' });
  const result = await command(config[role], config.cwd, prompt, remaining, prefix);
  state.modelMs += result.ms;
  state.active = null;
  state.events.push({
    role,
    source: state.source,
    code: result.code,
    timedOut: result.timedOut,
    ms: result.ms,
    prefix,
  });
  await persist();
  if (result.timedOut) {
    return { stop: 'execution_limit' };
  }
  if (result.code !== 0) {
    return { stop: `${role}_failed` };
  }
  return result;
}

async function cycle(
  config: Config,
  state: State,
  issue: string,
  persist: Persist,
): Promise<StopReason | null> {
  if (digest(await readIssue(config)) !== state.issueHash) {
    return 'requirements_changed';
  }
  state.source = await snapshot(config.cwd);
  const prefix = resolve(config.runDir, `check-${++state.checks}`);
  state.active = { role: 'check', prefix };
  await persist();
  const checked = await command(config.check, config.cwd, '', config.checkTimeMs, prefix);
  state.active = null;
  state.events.push({
    role: 'check',
    source: state.source,
    code: checked.code,
    timedOut: checked.timedOut,
    prefix,
  });
  await persist();
  const changed = await targetChange(config, state);
  if (changed) {
    return changed;
  }
  if (checked.timedOut || checked.code === null) {
    return 'check_unavailable';
  }
  let findings = `check failed. Read ${prefix}.stdout and ${prefix}.stderr.`;
  if (checked.code === 0) {
    const prompt = [
      'Independently inspect requirements, code, meaningful tests and required documentation.',
      'Do not edit files or run check; its host-side result is exit 0. Do not trust implementation claims.',
      'Return JSON {"status":"accepted"|"needs_changes","findings":"concrete unmet conditions or review summary"}.',
      `Requirements:\n${issue}`,
    ].join('\n');
    const reviewed = await runModel(config, state, 'review', prompt, persist);
    if ('stop' in reviewed) {
      return reviewed.stop;
    }
    const changed = await targetChange(config, state);
    if (changed) {
      return changed;
    }
    const review = parseReview(reviewed.stdout);
    if (!review) {
      return 'invalid_review';
    }
    if (review.status === 'accepted') {
      return 'ready_for_human_review';
    }
    findings = review.findings;
  }
  const prompt = [
    'Repair only within these agreed requirements. Read the current files and fix the root cause.',
    'Do not weaken tests or acceptance criteria. Do not commit, push or publish.',
    'Run only targeted checks needed to diagnose or validate your repair; leave the full check command to the host.',
    'The host will run the full check and an independent review after your changes.',
    'Return JSON with status repaired or needs_human, and findings explaining your changes or the necessary human decision.',
    'If requirements, permissions or execution limits must change, report needs_human without changing them.',
    `Requirements:\n${issue}\nFailure evidence:\n${findings}`,
  ].join('\n');
  const repaired = await runModel(config, state, 'repair', prompt, persist);
  if ('stop' in repaired) {
    return repaired.stop;
  }
  return repairOutcome(repaired.stdout);
}

function repairOutcome(stdout: string): StopReason | null {
  const value = parseReply(stdout);
  if (!value || !['repaired', 'needs_human'].includes(value.status)) {
    return 'invalid_repair';
  }
  return value.status === 'needs_human' ? 'human_decision_required' : null;
}

async function targetChange(config: Config, state: State): Promise<StopReason | null> {
  if (digest(await readIssue(config)) !== state.issueHash) {
    return 'requirements_changed';
  }
  if ((await snapshot(config.cwd)) !== state.source) {
    return 'source_changed';
  }
  return null;
}

async function run(config: Config) {
  validate(config);
  await mkdir(config.runDir, { recursive: true });
  const lock = resolve(config.runDir, 'lock');
  await mkdir(lock); // Existing lock requires reconciliation, never an automatic takeover.
  try {
    return await execute(config);
  } finally {
    await rm(lock, { recursive: true });
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function execute(config: Config): Promise<State> {
  const path = resolve(config.runDir, 'state.json');
  let state: State | undefined;
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'));
    assertState(value);
    state = value;
  } catch (error) {
    if (!isMissing(error)) {
      throw error;
    }
  }
  const configHash = digest(JSON.stringify(config));
  if (state && state.configHash !== configHash) {
    throw Error('Run configuration changed; do not reset the existing limits');
  }
  if (state?.active) {
    throw Error(interruptionMessage);
  }
  const issue = await readIssue(config);
  state ??= {
    configHash,
    issueHash: digest(issue),
    repair: 0,
    review: 0,
    checks: 0,
    modelMs: 0,
    active: null,
    events: [],
  };
  const persist = () => save(path, state);
  if (state.result) {
    const unchanged =
      state.issueHash === digest(issue) && state.source === (await snapshot(config.cwd));
    return { ...state, result: unchanged ? state.result : 'target_changed_after_stop' };
  }
  await persist();
  while (!state.result) {
    state.result = await cycle(config, state, issue, persist);
  }
  await persist();
  return state;
}

if (import.meta.main) {
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  try {
    const configFile = process.argv[2];
    if (!configFile) {
      throw Error('Usage: bun scripts/correction.ts CONFIG_FILE');
    }
    const config: unknown = JSON.parse(await readFile(configFile, 'utf8'));
    assertConfig(config);
    const result = await run(config);
    assertRunning();
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.result === 'ready_for_human_review' ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
  }
}
