import { test, expect, afterEach } from 'bun:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import type { Config } from '../input.ts';
import assert from 'node:assert/strict';
import { isRecord, isArray } from '../input.ts';

function object(value: unknown) {
  assert(isRecord(value));
  return value;
}
function events(value: unknown) {
  assert(isArray(value));
  return value;
}

const controller = resolve(import.meta.dir, '../correction.ts');
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function trial(mode: string, overrides: Partial<Config> = {}) {
  const root = await mkdtemp(join(tmpdir(), 'correction-test-'));
  roots.push(root);
  const cwd = join(root, 'work');
  const initialized = spawnSync('git', ['init', '-q', cwd]);
  if (initialized.status !== 0) {
    throw Error('Test repository initialization failed');
  }
  await writeFile(join(cwd, 'source.txt'), 'broken');
  const helper = join(root, 'helper.js');
  await writeFile(
    helper,
    `
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const role=process.argv[2], mode=${JSON.stringify(mode)};
if(role==='issue') console.log(mode==='issue_changed'&&existsSync(${JSON.stringify(join(root, 'issue-changed'))})?'Changed requirement':'Agreed requirement: correct source and docs');
if(role==='writing') {
 if(mode==='writing_failure') process.exit(1);
 writeFileSync('README.md','reviewed '+readFileSync('source.txt','utf8'));
}
if(role==='capture') {
 if(mode==='capture_timeout') await new Promise(r=>setTimeout(r,10000));
 if(mode==='capture_unavailable') {console.error('Host permission denied');process.exit(78);}
 if(mode==='capture_changed') writeFileSync('source.txt','changed by capture');
 if(mode==='capture_failure' && readFileSync('source.txt','utf8')==='broken') {console.error('Capture assertion failed');process.exit(1);}
 writeFileSync(join(process.argv[3],'desktop.png'),readFileSync('source.txt','utf8'));
}
if(role==='check') {
 if(mode==='check_timeout') await new Promise(r=>setTimeout(r,10000));
 if(mode==='normal') {console.log('source must be correct');console.error('validation failed: source is broken');}
 process.exit(readFileSync('source.txt','utf8')==='broken'?1:0);
}
if(role==='repair') {
 if(mode==='normal') {
  const prompt=readFileSync(0,'utf8');
  const stdout=${JSON.stringify(join(root, 'evidence/check-1.stdout'))};
  const stderr=${JSON.stringify(join(root, 'evidence/check-1.stderr'))};
  if(!prompt.includes(stdout)||!prompt.includes(stderr)) process.exit(3);
  const expected=readFileSync(stdout,'utf8').trim();
  const failure=readFileSync(stderr,'utf8').trim();
  if(expected!=='source must be correct'||failure!=='validation failed: source is broken') process.exit(4);
  if(prompt.includes(expected)||prompt.includes(failure)) process.exit(5);
 }
 if(mode==='null_repair') {console.log('null');process.exit(0);}
 if(mode==='timeout') await new Promise(r=>setTimeout(r,10000));
 if(mode==='human') {console.log(JSON.stringify({status:'needs_human',findings:'Need changed requirements'}));process.exit(0);}
 if(mode!=='exhaust') writeFileSync('source.txt','correct');
 if(existsSync(${JSON.stringify(join(root, 'reviewed'))})) writeFileSync('README.md','current');
 console.log(JSON.stringify({status:'repaired',findings:'fixed'}));
}
if(role==='review') {
 if(mode.startsWith('capture_') && readFileSync('trial/evidence/generated/desktop.png','utf8')!==readFileSync('source.txt','utf8')) process.exit(5);
 if(mode==='capture_review'&&!existsSync('README.md')) {writeFileSync(${JSON.stringify(join(root, 'reviewed'))},'1');console.log(JSON.stringify({status:'needs_changes',findings:'README missing'}));process.exit(0);}

 if(mode==='null_review') {console.log('null');process.exit(0);}
 if(mode==='review_failed') process.exit(2);
 if(mode==='issue_changed') writeFileSync(${JSON.stringify(join(root, 'issue-changed'))},'yes');
 if(mode==='malformed') console.log('success');
 else if(mode==='changed') {writeFileSync('source.txt','changed');console.log(JSON.stringify({status:'accepted',findings:''}));}
 else if(mode==='docs'&&!existsSync('README.md')) {writeFileSync(${JSON.stringify(join(root, 'reviewed'))},'1');console.log(JSON.stringify({status:'needs_changes',findings:'README missing'}));}
 else console.log(JSON.stringify({status:'accepted',findings:'checked'}));
}
`,
  );
  const config: Config = {
    cwd,
    runDir: join(root, 'evidence'),
    issue: [process.execPath, helper, 'issue'],
    check: [process.execPath, helper, 'check'],
    ...(mode.startsWith('writing_') ? { writing: [process.execPath, helper, 'writing'] } : {}),
    ...(mode.startsWith('capture_') ? { capture: [process.execPath, helper, 'capture'] } : {}),
    repair: [process.execPath, helper, 'repair'],
    review: [process.execPath, helper, 'review'],
    repairLimit: 2,
    reviewLimit: 2,
    modelTimeMs: 15000,
    checkTimeMs: 1000,
    ...overrides,
  };
  const configFile = join(root, 'config.json');
  await writeFile(configFile, JSON.stringify(config));
  const execute = () =>
    spawnSync(process.execPath, [controller, configFile], { encoding: 'utf8', timeout: 20000 });
  return {
    root,
    config,
    configFile,
    execute,
    state: async () =>
      object(JSON.parse(await readFile(join(config.runDir, 'state.json'), 'utf8'))),
  };
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
  expect(object(events(state.events).at(-1)).timedOut).toBe(true);
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
  expect([state.repair, state.review]).toEqual([0, 0]);
  expect(object(events(state.events)[0]).timedOut).toBe(true);
});

test('check startup failure retains the error without starting a model', async () => {
  const t = await trial('normal', { check: ['/nonexistent-correction-test-command'] });
  expect(t.execute().status).toBe(1);
  const state = await t.state();
  expect(state.result).toBe('check_unavailable');
  expect([state.repair, state.review]).toEqual([0, 0]);
  const error = await readFile(join(t.config.runDir, 'check-1.stderr'), 'utf8');
  expect(error).toContain('ENOENT');
});

async function waitForFile(path: string) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    try {
      return await readFile(path, 'utf8');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }
    }
    await Bun.sleep(20);
  }
  throw Error(`Timed out waiting for ${path}`);
}

for (const role of ['check', 'repair', 'review', 'capture'] as const) {
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGKILL'] as const) {
    test(`${signal} during ${role} preserves reservation and blocks duplicate execution`, async () => {
      const t = await trial('normal', { checkTimeMs: 15000 });
      if (role === 'review') {
        await writeFile(join(t.config.cwd, 'source.txt'), 'correct');
      }
      const pidFile = join(t.root, 'actor.pid');
      const heartbeat = join(t.config.cwd, 'heartbeat');
      const worker = join(t.root, 'worker.js');
      await writeFile(
        worker,
        `
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const [heartbeat, pidFile] = process.argv.slice(2);
if (pidFile) {
  spawn(process.execPath, [process.argv[1], heartbeat], {stdio:'inherit'});
  writeFileSync(pidFile, String(process.pid));
} else {
  setInterval(() => writeFileSync(heartbeat, String(Date.now())), 20);
}
`,
      );
      await writeFile(
        t.configFile,
        JSON.stringify({ ...t.config, [role]: [process.execPath, worker, heartbeat, pidFile] }),
      );
      const child = spawn(process.execPath, [controller, t.configFile], { stdio: 'ignore' });
      const stateFile = join(t.config.runDir, 'state.json');
      const closed = new Promise<number | null>((resolve) => child.on('close', resolve));
      let group: number | undefined;
      try {
        group = Number(await waitForFile(pidFile));
        await waitForFile(heartbeat);
        const before = await readFile(stateFile, 'utf8');
        const state = object(JSON.parse(before));
        expect(object(state.active).role).toBe(role);
        expect(state[role === 'check' || role === 'capture' ? 'checks' : role]).toBe(
          role === 'capture' ? 0 : 1,
        );
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
          try {
            process.kill(-group, 'SIGKILL');
          } catch {
            /* Already stopped. */
          }
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
    expect(object(JSON.parse(result.stdout)).result).toBe('target_changed_after_stop');
    expect(await t.state()).toEqual(before);
  });
}

for (const [name, change] of [
  ['missing cwd', { cwd: undefined }],
  ['empty command', { repair: [] }],
  ['invalid limit', { reviewLimit: -1 }],
] as const) {
  test(`invalid config: ${name}`, async () => {
    const t = await trial('normal');
    await writeFile(t.configFile, JSON.stringify({ ...t.config, ...change }));
    const result = t.execute();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid');
    expect(await readFile(join(t.config.cwd, 'source.txt'), 'utf8')).toBe('broken');
  });
}
for (const change of [
  { repair: -1 },
  { active: { role: 'repair' } },
  { events: [{}] },
  { result: 'unrecognized_success' },
  { captureSource: 42 },
]) {
  test(`invalid saved state is retained and rejected: ${JSON.stringify(change)}`, async () => {
    const t = await trial('normal');
    expect(t.execute().status).toBe(0);
    const stateFile = join(t.config.runDir, 'state.json');
    const invalid = JSON.stringify({ ...(await t.state()), ...change });
    await writeFile(stateFile, invalid);
    const result = t.execute();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid');
    expect(await readFile(stateFile, 'utf8')).toBe(invalid);
  });
}
test('missing CLI configuration argument fails with usage', () => {
  const result = spawnSync(process.execPath, [controller], { encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Usage:');
});

for (const path of ['.', 'evidence', '..evidence', '../..external']) {
  test(`evidence directory boundary: ${path}`, async () => {
    const t = await trial('boundary');
    const runDir = resolve(t.config.cwd, path);
    await writeFile(t.configFile, JSON.stringify({ ...t.config, runDir }));
    const result = t.execute();
    if (path === '../..external') {
      expect(result.status).toBe(0);
    } else {
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Evidence must be outside the worktree');
      expect(await Bun.file(join(runDir, 'state.json')).exists()).toBe(false);
      expect(await readFile(join(t.config.cwd, 'source.txt'), 'utf8')).toBe('broken');
    }
  });
}

test('split UTF-8 survives requirements, actor replies and both logs', async () => {
  const t = await trial('unicode');
  await writeFile(
    join(t.root, 'helper.js'),
    `import {readFileSync,writeFileSync} from 'node:fs';
const role=process.argv[2];
async function split(stream,text) {
 const bytes=Buffer.from(text);
 const cut=bytes.findIndex(byte=>byte>127)+1;
 stream.write(bytes.subarray(0,cut));
 await new Promise(resolve=>setTimeout(resolve,50));
 stream.write(bytes.subarray(cut));
}
if(role==='issue') await split(process.stdout,'日本語の要件');
if(role==='check' && readFileSync('source.txt','utf8')==='broken') {
 await split(process.stdout,'確認結果');
 await split(process.stderr,'修正が必要');
 process.exitCode=1;
}
if(role==='repair') {
 writeFileSync('source.txt','correct');
 await split(process.stdout,JSON.stringify({status:'repaired',findings:'修正済み'}));
}
if(role==='review') await split(process.stdout,JSON.stringify({status:'accepted',findings:'検証済み'}));
`,
  );
  expect(t.execute().status).toBe(0);
  for (const role of ['repair', 'review']) {
    expect(await readFile(join(t.config.runDir, `${role}-1.prompt`), 'utf8')).toContain(
      '日本語の要件',
    );
  }
  expect(await readFile(join(t.config.runDir, 'check-1.stdout'), 'utf8')).toBe('確認結果');
  expect(await readFile(join(t.config.runDir, 'check-1.stderr'), 'utf8')).toBe('修正が必要');
  for (const [role, findings] of [
    ['repair', '修正済み'],
    ['review', '検証済み'],
  ]) {
    const reply = object(
      JSON.parse(await readFile(join(t.config.runDir, `${role}-1.stdout`), 'utf8')),
    );
    expect(reply.findings).toBe(findings);
  }
});

for (const [mode, result, captures, reviews] of [
  ['capture_success', 'ready_for_human_review', 2, 1],
  ['capture_review', 'ready_for_human_review', 2, 2],
  ['capture_failure', 'ready_for_human_review', 2, 1],
  ['capture_unavailable', 'capture_unavailable', 1, 0],
  ['capture_timeout', 'capture_timeout', 1, 0],
  ['capture_changed', 'source_changed', 1, 0],
] as const) {
  test(`${mode} through controller entry`, async () => {
    const t = await trial(mode, { checkTimeMs: 500 });
    const resultProcess = t.execute();
    expect(resultProcess.status).toBe(result === 'ready_for_human_review' ? 0 : 1);
    const state = await t.state();
    expect(state.result).toBe(result);
    expect(state.review).toBe(reviews);
    expect(events(state.events).filter((event) => object(event).role === 'capture')).toHaveLength(
      captures,
    );
    if (result === 'ready_for_human_review') {
      expect(
        await readFile(join(t.config.cwd, 'trial/evidence/generated/desktop.png'), 'utf8'),
      ).toBe('correct');
      const before = JSON.stringify(state);
      expect(t.execute().status).toBe(0);
      expect(JSON.stringify(await t.state())).toBe(before);
      await writeFile(join(t.config.cwd, 'trial/evidence/generated/desktop.png'), 'stale');
      expect(object(JSON.parse(t.execute().stdout)).result).toBe('target_changed_after_stop');
    }
    if (mode === 'capture_unavailable') {
      expect(state.findings).toContain('capture-1.stderr');
      expect(state.repair).toBe(0);
    }
  });
}

for (const kind of [
  'tracked-doc',
  'staged-doc',
  'new-doc',
  'deleted-doc',
  'new-code',
  'tracked-code',
]) {
  test(`capture preserves existing media only for Markdown changes: ${kind}`, async () => {
    const t = await trial('media_scope');
    const { cwd } = t.config;
    const git = (...args: string[]) => {
      const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
      expect(result.status).toBe(0);
    };
    const media = join(cwd, 'trial/evidence/generated/desktop.png');
    await mkdir(join(cwd, 'trial/evidence/generated'), { recursive: true });
    await writeFile(join(cwd, 'source.txt'), 'correct');
    await writeFile(join(cwd, 'README.md'), 'original');
    await writeFile(join(cwd, 'app.js'), 'original');
    await writeFile(media, 'retained');
    git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'baseline');
    if (kind === 'deleted-doc') {
      await rm(join(cwd, 'README.md'));
    } else {
      const name =
        kind === 'new-doc'
          ? 'NEW.md'
          : kind === 'new-code'
            ? 'new.js'
            : kind === 'tracked-code'
              ? 'app.js'
              : 'README.md';
      await writeFile(join(cwd, name), 'current');
      if (kind === 'staged-doc') {
        git('add', 'README.md');
      }
    }
    t.config.capture = [process.execPath, join(t.root, 'helper.js'), 'capture'];
    await writeFile(t.configFile, JSON.stringify(t.config));
    expect(t.execute().status).toBe(0);
    const state = await t.state();
    const hasCode = kind.endsWith('code');
    expect(events(state.events).filter((event) => object(event).role === 'capture')).toHaveLength(
      hasCode ? 1 : 0,
    );
    expect(state.checks).toBe(1);
    expect(state.review).toBe(1);
    expect(state.result).toBe('ready_for_human_review');
    expect(await readFile(media, 'utf8')).toBe(hasCode ? 'correct' : 'retained');
  });
}

test('documentation repair keeps media unchanged through both checks and reviews', async () => {
  const t = await trial('docs');
  const { cwd } = t.config;
  const git = (...args: string[]) => {
    expect(spawnSync('git', args, { cwd }).status).toBe(0);
  };
  const media = join(cwd, 'trial/evidence/generated/desktop.png');
  await mkdir(join(cwd, 'trial/evidence/generated'), { recursive: true });
  await writeFile(join(cwd, 'source.txt'), 'correct');
  await writeFile(join(cwd, 'README.md'), 'original');
  await writeFile(media, 'retained');
  git('add', '.');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'baseline');
  await rm(join(cwd, 'README.md'));
  t.config.capture = [process.execPath, join(t.root, 'helper.js'), 'capture'];
  await writeFile(t.configFile, JSON.stringify(t.config));
  expect(t.execute().status).toBe(0);
  const state = await t.state();
  expect(events(state.events).filter((event) => object(event).role === 'capture')).toHaveLength(0);
  expect(state.checks).toBe(2);
  expect(state.review).toBe(2);
  expect(state.repair).toBe(1);
  expect(await readFile(join(cwd, 'README.md'), 'utf8')).toBe('current');
  expect(await readFile(media, 'utf8')).toBe('retained');
});

for (const change of [
  'records',
  'delete-record',
  'source',
  'definition',
  'media',
  'symlink',
  'executable',
]) {
  test(`successful capture reuse after review repair: ${change}`, async () => {
    const t = await trial('reuse');
    const helper = join(t.root, 'reuse.js');
    await writeFile(join(t.config.cwd, 'source.txt'), 'correct');
    await mkdir(join(t.config.cwd, 'trial/evidence'), { recursive: true });
    await writeFile(join(t.config.cwd, 'trial/evidence/old.json'), '{}');
    await writeFile(
      helper,
      `
import {readFileSync,writeFileSync,existsSync,mkdirSync,rmSync,symlinkSync,chmodSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const role=process.argv[2], change=${JSON.stringify(change)};
const media='trial/evidence/generated/demo.webm', record='trial/evidence/provenance.json';
const hash=()=>createHash('sha256').update(readFileSync(media)).digest('hex');
if(role==='capture') writeFileSync(join(process.argv[3],'demo.webm'),crypto.randomUUID());
if(role==='repair') {
 writeFileSync('README.md','updated explanation');
 writeFileSync(record,JSON.stringify({hash:hash()}));
 writeFileSync('trial/evidence/check.stdout','passed');
 if(change==='delete-record') rmSync('trial/evidence/old.json');
 if(change==='source') writeFileSync('app.js','changed app');
 if(change==='definition') writeFileSync('trial/capture.spec.js','changed capture');
 if(change==='media') writeFileSync(media,'altered');
 if(change==='symlink') symlinkSync('../source.txt','trial/input.md');
 if(change==='executable') {writeFileSync('trial/evidence/command.txt','executable');chmodSync('trial/evidence/command.txt',0o755);}
 console.log(JSON.stringify({status:'repaired',findings:'updated'}));
}
if(role==='review') {
 const status=existsSync(record)?'accepted':'needs_changes';
 if(status==='accepted') {
  const same=JSON.parse(readFileSync(record,'utf8')).hash===hash();
  if(same!==['records','delete-record'].includes(change)) process.exit(7);
 }
 console.log(JSON.stringify({status,findings:'verify media identity'}));
}
`,
    );
    t.config.capture = [process.execPath, helper, 'capture'];
    t.config.repair = [process.execPath, helper, 'repair'];
    t.config.review = [process.execPath, helper, 'review'];
    await writeFile(t.configFile, JSON.stringify(t.config));
    expect(t.execute().status).toBe(0);
    const state = await t.state();
    expect(state.result).toBe('ready_for_human_review');
    expect(state.checks).toBe(2);
    expect(state.review).toBe(2);
    expect(state.repair).toBe(1);
    expect(events(state.events).filter((event) => object(event).role === 'capture')).toHaveLength(
      ['records', 'delete-record'].includes(change) ? 1 : 2,
    );
  });
}

for (const mode of ['writing_success', 'writing_failure']) {
  test(`writing before check and after repair: ${mode}`, async () => {
    const fixture = await trial(mode);
    fixture.execute();
    const state = await fixture.state();
    expect(state.result).toBe(
      mode === 'writing_success' ? 'ready_for_human_review' : 'writing_failed',
    );
    if (mode === 'writing_success') {
      expect(await readFile(join(fixture.config.cwd, 'README.md'), 'utf8')).toBe(
        'reviewed correct',
      );
      expect(events(state.events).map((event) => object(event).role)).toEqual([
        'writing',
        'check',
        'repair',
        'writing',
        'check',
        'review',
      ]);
    } else {
      expect(state.checks).toBe(0);
      expect(state.review).toBe(0);
    }
  });
}
