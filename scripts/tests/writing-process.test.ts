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
