import { test, expect } from 'bun:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { command } from '../correction.ts';

for (const stop of ['model_timeout', 'host_timeout']) {
  test(`writing retains output and stops descendants on ${stop}`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'writing-process-'));
    const worker = join(dir, 'worker.ts'),
      wrapper = join(dir, 'wrapper.ts');
    await writeFile(
      wrapper,
      `import {spawn} from 'node:child_process'; import {writeFileSync} from 'node:fs';
const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
writeFileSync(${JSON.stringify(join(dir, 'pid'))},String(child.pid));
console.log('partial output'); console.error('partial diagnostic'); setInterval(()=>{},1000);`,
    );
    await writeFile(
      worker,
      `import {runWritingCommand} from ${JSON.stringify(resolve(import.meta.dir, '../writing.ts'))};
await runWritingCommand([process.execPath,${JSON.stringify(wrapper)}],${JSON.stringify(dir)},'',${JSON.stringify(join(dir, 'model'))},${stop === 'model_timeout' ? 500 : 10000});`,
    );
    let pid: number | undefined;
    try {
      const result = await command(
        [process.execPath, worker],
        dir,
        '',
        stop === 'host_timeout' ? 700 : 3000,
      );
      pid = Number(await readFile(join(dir, 'pid'), 'utf8'));
      expect(result.code === 0 && !result.timedOut).toBe(false);
      expect(await readFile(join(dir, 'model.stdout'), 'utf8')).toContain('partial output');
      expect(await readFile(join(dir, 'model.stderr'), 'utf8')).toContain('partial diagnostic');
      let alive = true;
      for (let i = 0; i < 20; i++) {
        try {
          process.kill(pid, 0);
        } catch {
          alive = false;
          break;
        }
        await new Promise((done) => setTimeout(done, 25));
      }
      expect(alive).toBe(false);
    } finally {
      if (pid) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {}
      }
      await rm(dir, { recursive: true, force: true });
    }
  });
}

for (const scenario of [
  { name: 'wrong_model', status: 'ERROR' },
  { name: 'malformed', status: 'ERROR' },
  { name: 'unknown_status', status: 'UNKNOWN' },
  { name: 'success_response_nonzero_exit', status: 'SUCCESS', response: 'not JSON' },
  {
    name: 'numeric_crash',
    status: 'ERROR',
    output: '',
    stderr: 'TypeError: unexpected value at /cli.js:503:12',
  },
  { name: 'service_error', status: 'ERROR', skip: true },
  { name: 'service_error_child', status: 'ERROR', skip: true, descendant: true },
  { name: 'timeout', status: 'ERROR', skip: true, descendant: true },
]) {
  test(`writing process classifies ${scenario.name} without hiding invalid output`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'writing-availability-'));
    const worker = join(dir, 'writing-review.ts');
    const timedOut = scenario.name === 'timeout';
    const init = JSON.stringify({
      event: 'init',
      init: { model: scenario.name === 'wrong_model' ? 'wrong' : 'gemini-3.8-flash-high' },
    });
    const result = JSON.stringify({
      event: 'result',
      result: {
        status: scenario.status,
        error: '503 service unavailable',
        response: scenario.response,
      },
    });
    const output =
      scenario.name === 'malformed' ? 'not json' : timedOut ? init : `${init}\n${result}`;
    const descendant = `const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'}); writeFileSync(${JSON.stringify(join(dir, 'pid'))},String(child.pid));`;
    await writeFile(
      join(dir, 'agy'),
      `#!${process.execPath}\nimport {spawn} from 'node:child_process'; import {writeFileSync} from 'node:fs';
console.log(${JSON.stringify(scenario.output ?? output)});
${scenario.skip ? '' : `console.error(${JSON.stringify(scenario.stderr ?? '503 service unavailable')});`}
${scenario.descendant ? descendant : ''}
${timedOut ? 'setInterval(()=>{},1000);' : 'process.exit(1);'}
`,
      { mode: 0o755 },
    );
    await writeFile(
      worker,
      `import {runWritingCommand, reviewWriting} from ${JSON.stringify(resolve(import.meta.dir, '../writing.ts'))};
process.env.PATH=${JSON.stringify(dir)};
await reviewWriting([{name:'test.md',body:'original'}],'facts',${JSON.stringify(join(dir, 'review'))},(argv,cwd,input,prefix)=>runWritingCommand(argv,cwd,input,prefix,${timedOut ? 1500 : 5000}));`,
    );
    try {
      const result = await command([process.execPath, worker, '--worker'], dir, '', 10000);
      expect(result.timedOut).toBe(false);
      expect(result.code === 0).toBe(Boolean(scenario.skip));
      const receipt = await readFile(join(dir, 'review/skipped.json'), 'utf8').catch(() => null);
      expect(receipt !== null).toBe(Boolean(scenario.skip));
      if (scenario.skip) {
        expect(receipt).toContain(`"reason":"${timedOut ? 'timeout' : 'service_unavailable'}"`);
      }
      if (scenario.descendant) {
        const pid = Number(await readFile(join(dir, 'pid'), 'utf8'));
        await new Promise((done) => setTimeout(done, 100));
        expect(() => process.kill(pid, 0)).toThrow();
      }
    } finally {
      const pid = Number(await readFile(join(dir, 'pid'), 'utf8').catch(() => '0'));
      stopChild(pid);
      await rm(dir, { recursive: true, force: true });
    }
  });
}

function stopChild(pid: number | undefined) {
  if (pid) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {}
  }
}
