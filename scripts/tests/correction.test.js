import { test, expect } from 'bun:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const controller = resolve(import.meta.dir, '../../scripts/correction.js');
async function trial(mode, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'correction-test-'));
  const cwd = join(root, 'work');
  spawnSync('git', ['init', '-q', cwd]);
  await writeFile(join(cwd, 'source.txt'), 'broken');
  const helper = join(root, 'helper.js');
  await writeFile(helper, `
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const role=process.argv[2], mode=${JSON.stringify(mode)};
if(role==='issue') console.log(mode==='issue_changed'&&existsSync(${JSON.stringify(join(root, "issue-changed"))})?'Changed requirement':'Agreed requirement: correct source and docs');
if(role==='check') process.exit(readFileSync('source.txt','utf8')==='broken'?1:0);
if(role==='repair') {
 if(mode==='timeout') await new Promise(r=>setTimeout(r,10000));
 if(mode==='human') {console.log(JSON.stringify({status:'needs_human',findings:'Need changed requirements'}));process.exit(0);}
 if(mode!=='exhaust') writeFileSync('source.txt','correct');
 if(existsSync('reviewed')) writeFileSync('README.md','current');
 console.log(JSON.stringify({status:'repaired',findings:'fixed'}));
}
if(role==='review') {
 if(mode==='review_failed') process.exit(2);
 if(mode==='issue_changed') writeFileSync(${JSON.stringify(join(root, 'issue-changed'))},'yes');
 if(mode==='malformed') console.log('success');
 else if(mode==='changed') {writeFileSync('source.txt','changed');console.log(JSON.stringify({status:'accepted',findings:''}));}
 else if(mode==='docs'&&!existsSync('README.md')) {writeFileSync(${JSON.stringify(join(root, 'reviewed'))},'1');console.log(JSON.stringify({status:'needs_changes',findings:'README missing'}));}
 else console.log(JSON.stringify({status:'accepted',findings:'checked'}));
}
`);
  // Repair reads this external marker without contaminating the source snapshot.
  let helperText = await readFile(helper, 'utf8');
  helperText = helperText.replace("existsSync('reviewed')", `existsSync(${JSON.stringify(join(root, 'reviewed'))})`);
  await writeFile(helper, helperText);
  const config = { cwd, runDir: join(root, 'evidence'), issue: [process.execPath, helper, 'issue'],
    check: [process.execPath, helper, 'check'], repair: [process.execPath, helper, 'repair'], review: [process.execPath, helper, 'review'],
    repairLimit: 2, reviewLimit: 2, modelTimeMs: 15000, checkTimeMs: 1000, ...overrides };
  const configFile = join(root, 'config.json');
  await writeFile(configFile, JSON.stringify(config));
  const execute = () => spawnSync(process.execPath, [controller, configFile], { encoding: 'utf8', timeout: 20000 });
  return { root, config, configFile, execute, state: async () => JSON.parse(await readFile(join(config.runDir, 'state.json'), 'utf8')) };
}

for (const [mode, result, repairs, reviews] of [
  ['normal', 'ready_for_human_review', 1, 1],
  ['human', 'human_decision_required', 1, 0],
  ['issue_changed', 'requirements_changed', 1, 1],
  ['review_failed', 'review_failed', 1, 1],
  ['docs', 'ready_for_human_review', 2, 2],
  ['malformed', 'invalid_review', 1, 1],
  ['changed', 'source_changed', 1, 1],
  ['exhaust', 'execution_limit', 2, 0],
]) {
  test(mode, async () => {
    const t = await trial(mode);
    try {
      t.execute();
      const state = await t.state();
      expect(state.result).toBe(result);
      expect(state.repair).toBe(repairs);
      expect(state.review).toBe(reviews);
      const before = JSON.stringify(state);
      t.execute();
      expect(JSON.stringify(await t.state())).toBe(before);
    } finally { await rm(t.root, { recursive: true, force: true }); }
  });
}

test('time limit terminates actor and keeps consumed reservation', async () => {
  const t = await trial('timeout', { modelTimeMs: 100 });
  try {
    t.execute();
    const state = await t.state();
    expect(state.result).toBe('execution_limit');
    expect(state.repair).toBe(1);
    expect(state.active).toBeNull();
    expect(state.events.at(-1).timedOut).toBe(true);
    t.execute();
    expect((await t.state()).repair).toBe(1);
  } finally { await rm(t.root, { recursive: true, force: true }); }
});

test('changed limits cannot reset an existing trial', async () => {
  const t = await trial('exhaust');
  try {
    t.execute();
    await writeFile(t.configFile, JSON.stringify({ ...t.config, repairLimit: 10 }));
    const result = t.execute();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('configuration changed');
    expect((await t.state()).repair).toBe(2);
  } finally { await rm(t.root, { recursive: true, force: true }); }
});

test('interrupted reservation blocks restart instead of calling another actor', async () => {
  const t = await trial('normal');
  try {
    t.execute();
    const state = await t.state();
    state.active = { role: 'review' };
    await writeFile(join(t.config.runDir, 'state.json'), JSON.stringify(state));
    const result = t.execute();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Interrupted execution');
    expect((await t.state()).review).toBe(1);
  } finally { await rm(t.root, { recursive: true, force: true }); }
});

test('terminal success is not reused for changed documentation', async () => {
  const t = await trial('normal');
  try {
    t.execute();
    await writeFile(join(t.config.cwd, 'README.md'), 'new documentation');
    const result = t.execute();
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).result).toBe('target_changed_after_stop');
    expect((await t.state()).review).toBe(1);
  } finally { await rm(t.root, { recursive: true, force: true }); }
});
