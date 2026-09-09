import { test, expect, afterEach } from 'bun:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import type { Config } from '../correction.ts';

const controller = resolve(import.meta.dir, '../correction.ts');
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});
async function trial(mode: string, overrides: Partial<Config> = {}) {
  const root = await mkdtemp(join(tmpdir(), 'correction-test-'));
  roots.push(root);
  const cwd = join(root, 'work');
  const initialized = spawnSync('git', ['init', '-q', cwd]);
  if (initialized.status !== 0) throw Error('Test repository initialization failed');
  await writeFile(join(cwd, 'source.txt'), 'broken');
  const helper = join(root, 'helper.js');
  await writeFile(helper, `
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const role=process.argv[2], mode=${JSON.stringify(mode)};
if(role==='issue') console.log(mode==='issue_changed'&&existsSync(${JSON.stringify(join(root, "issue-changed"))})?'Changed requirement':'Agreed requirement: correct source and docs');
if(role==='check') {
 if(mode==='check_timeout') await new Promise(r=>setTimeout(r,10000));
 process.exit(readFileSync('source.txt','utf8')==='broken'?1:0);
}
if(role==='repair') {
 if(mode==='null_repair') {console.log('null');process.exit(0);}
 if(mode==='timeout') await new Promise(r=>setTimeout(r,10000));
 if(mode==='human') {console.log(JSON.stringify({status:'needs_human',findings:'Need changed requirements'}));process.exit(0);}
 if(mode!=='exhaust') writeFileSync('source.txt','correct');
 if(existsSync(${JSON.stringify(join(root, 'reviewed'))})) writeFileSync('README.md','current');
 console.log(JSON.stringify({status:'repaired',findings:'fixed'}));
}
if(role==='review') {
 if(mode==='null_review') {console.log('null');process.exit(0);}
 if(mode==='review_failed') process.exit(2);
 if(mode==='issue_changed') writeFileSync(${JSON.stringify(join(root, 'issue-changed'))},'yes');
 if(mode==='malformed') console.log('success');
 else if(mode==='changed') {writeFileSync('source.txt','changed');console.log(JSON.stringify({status:'accepted',findings:''}));}
 else if(mode==='docs'&&!existsSync('README.md')) {writeFileSync(${JSON.stringify(join(root, 'reviewed'))},'1');console.log(JSON.stringify({status:'needs_changes',findings:'README missing'}));}
 else console.log(JSON.stringify({status:'accepted',findings:'checked'}));
}
`);
  const config: Config = { cwd, runDir: join(root, 'evidence'), issue: [process.execPath, helper, 'issue'],
    check: [process.execPath, helper, 'check'], repair: [process.execPath, helper, 'repair'], review: [process.execPath, helper, 'review'],
    repairLimit: 2, reviewLimit: 2, modelTimeMs: 15000, checkTimeMs: 1000, ...overrides };
  const configFile = join(root, 'config.json');
  await writeFile(configFile, JSON.stringify(config));
  const execute = () => spawnSync(process.execPath, [controller, configFile], { encoding: 'utf8', timeout: 20000 });
  return { root, config, configFile, execute, state: async () => JSON.parse(await readFile(join(config.runDir, 'state.json'), 'utf8')) };
}

for (const [mode, result, repairs, reviews] of [
  ['normal', 'ready_for_human_review', 1, 1],
  ['null_repair', 'invalid_repair', 1, 0],
  ['null_review', 'invalid_review', 1, 1],
  ['human', 'human_decision_required', 1, 0],
  ['issue_changed', 'requirements_changed', 1, 1],
  ['review_failed', 'review_failed', 1, 1],
  ['docs', 'ready_for_human_review', 2, 2],
  ['malformed', 'invalid_review', 1, 1],
  ['changed', 'source_changed', 1, 1],
  ['exhaust', 'execution_limit', 2, 0],
] as const) {
  test(mode, async () => {
    const t = await trial(mode);
    expect(t.execute().status).toBe(result === 'ready_for_human_review' ? 0 : 1);
    const state = await t.state();
    expect(state.result).toBe(result);
    expect(state.repair).toBe(repairs);
    expect(state.review).toBe(reviews);
    const before = JSON.stringify(state);
    t.execute();
    expect(JSON.stringify(await t.state())).toBe(before);
  });
}

test('time limit terminates actor and keeps consumed reservation', async () => {
  const t = await trial('timeout', { modelTimeMs: 100 });
  t.execute();
  const state = await t.state();
  expect(state.result).toBe('execution_limit');
  expect(state.repair).toBe(1);
  expect(state.active).toBeNull();
  expect(state.events.at(-1).timedOut).toBe(true);
  t.execute();
  expect((await t.state()).repair).toBe(1);
});

test('changed limits cannot reset an existing trial', async () => {
  const t = await trial('exhaust');
  t.execute();
  await writeFile(t.configFile, JSON.stringify({ ...t.config, repairLimit: 10 }));
  const result = t.execute();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('configuration changed');
  expect((await t.state()).repair).toBe(2);
});

test('review limit prevents a third-party evaluator from being called again', async () => {
  const t = await trial('docs', { reviewLimit: 1 });
  t.execute();
  const state = await t.state();
  expect(state.result).toBe('execution_limit');
  expect(state.review).toBe(1);
  expect(state.repair).toBe(2);
});

test('check timeout is unavailable evidence and does not start a model', async () => {
  const t = await trial('check_timeout', { checkTimeMs: 100 });
  t.execute();
  const state = await t.state();
  expect(state.result).toBe('check_unavailable');
  expect(state.repair + state.review).toBe(0);
  expect(state.events[0].timedOut).toBe(true);
});

test('check startup failure retains the error without starting a model', async () => {
  const t = await trial('normal', { check: ['/nonexistent-correction-test-command'] });
  expect(t.execute().status).toBe(1);
  const state = await t.state();
  expect(state.result).toBe('check_unavailable');
  expect(state.repair + state.review).toBe(0);
  const error = await readFile(join(t.config.runDir, 'check-1.stderr'), 'utf8');
  expect(error).toContain('ENOENT');
});

async function waitForFile(path: string) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    try { return await readFile(path, 'utf8'); } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    await Bun.sleep(20);
  }
  throw Error(`Timed out waiting for ${path}`);
}

for (const role of ['check', 'repair', 'review'] as const) {
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGKILL'] as const) {
    test(`${signal} during ${role} preserves reservation and blocks duplicate execution`, async () => {
      const t = await trial('normal', { checkTimeMs: 15000 });
      if (role === 'review') await writeFile(join(t.config.cwd, 'source.txt'), 'correct');
      const pidFile = join(t.root, 'actor.pid');
      const heartbeat = join(t.config.cwd, 'heartbeat');
      const worker = join(t.root, 'worker.js');
      await writeFile(worker, `
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const [heartbeat, pidFile] = process.argv.slice(2);
if (pidFile) {
  spawn(process.execPath, [process.argv[1], heartbeat], {stdio:'inherit'});
  writeFileSync(pidFile, String(process.pid));
} else {
  setInterval(() => writeFileSync(heartbeat, String(Date.now())), 20);
}
`);
      await writeFile(t.configFile, JSON.stringify({ ...t.config, [role]: [process.execPath, worker, heartbeat, pidFile] }));
      const child = spawn(process.execPath, [controller, t.configFile], { stdio: 'ignore' });
      const stateFile = join(t.config.runDir, 'state.json');
      const closed = new Promise<number | null>(resolve => child.on('close', resolve));
      let group: number | undefined;
      try {
        group = Number(await waitForFile(pidFile));
        await waitForFile(heartbeat);
        const before = await readFile(stateFile, 'utf8');
        const state = JSON.parse(before);
        expect(state.active.role).toBe(role);
        expect(state[role === 'check' ? 'checks' : role]).toBe(1);
        // A second controller must not enter the same run while the first is alive.
        expect(t.execute().status).toBe(1);
        child.kill(signal);
        expect(await closed).toBe(signal === 'SIGKILL' ? null : 1);
        if (signal !== 'SIGKILL') {
          const stopped = await readFile(heartbeat, 'utf8');
          await Bun.sleep(150);
          expect(await readFile(heartbeat, 'utf8')).toBe(stopped);
        }
        expect(await readFile(stateFile, 'utf8')).toBe(before);
        const retry = t.execute();
        expect(retry.status).toBe(1);
        expect(retry.stderr).toContain(signal === 'SIGKILL' ? 'EEXIST' : 'Interrupted execution');
        expect(await readFile(stateFile, 'utf8')).toBe(before);
      } finally {
        child.kill('SIGKILL');
        if (group !== undefined) {
          try { process.kill(-group, 'SIGKILL'); } catch { /* Already stopped. */ }
        }
        await closed;
      }
    }, 10000);
  }
}

for (const [target, path, content] of [
  ['documentation', 'work/README.md', 'new documentation'],
  ['Issue', 'helper.js', "console.log('Updated requirements');"],
] as const) {
  test(`terminal success is not reused for changed ${target}`, async () => {
    const t = await trial('normal');
    expect(t.execute().status).toBe(0);
    const before = await t.state();
    await writeFile(join(t.root, path), content);
    const result = t.execute();
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).result).toBe('target_changed_after_stop');
    expect(await t.state()).toEqual(before);
  });
}
