import { test, expect } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

for (const mode of ['normal', 'nonzero', 'missing', 'write_error'] as const) {
  test(`Codex actor logs: ${mode}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'actor-stream-'));
    try {
      const preload = join(root, 'preload.ts');
      await writeFile(
        preload,
        `import { mock } from 'bun:test';
import { createWriteStream, mkdirSync } from 'node:fs';
const original = createWriteStream;
mock.module('node:fs', () => ({ createWriteStream(path) {
  mkdirSync(path);
  return original(path);
} }));`,
      );
      if (mode !== 'missing') {
        await writeFile(
          join(root, 'codex'),
          `#!${process.execPath}
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
writeFileSync(args[args.indexOf('-o') + 1], JSON.stringify({status:'accepted', findings:''}));
process.stdout.write('x'.repeat(2 * 1024 * 1024) + 'stdout-end');
process.stderr.write('y'.repeat(2 * 1024 * 1024) + 'stderr-end');
process.exitCode = ${mode === 'nonzero' ? 7 : 0};
`,
          { mode: 0o755 },
        );
      }
      const result = spawnSync(
        process.execPath,
        [
          ...(mode === 'write_error' ? ['--preload', preload] : []),
          resolve('scripts/codex-actor.ts'),
          'review',
          root,
        ],
        {
          env: { ...process.env, PATH: root },
          input: 'Review fixture',
          encoding: 'utf8',
          timeout: 10000,
        },
      );
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(mode === 'normal' ? 0 : 1);
      if (mode === 'normal') {
        expect(JSON.parse(result.stdout)).toEqual({ status: 'accepted', findings: '' });
      } else {
        expect(result.stdout).toBe('');
      }
      const entries = await readdir(root);
      const dir = entries.find((entry) => entry.startsWith('review-codex-'));
      expect(dir).toBeDefined();
      if (dir && (mode === 'normal' || mode === 'nonzero')) {
        expect(await readFile(join(root, dir, 'events.jsonl'), 'utf8')).toBe(
          'x'.repeat(2 * 1024 * 1024) + 'stdout-end',
        );
        expect(await readFile(join(root, dir, 'stderr.log'), 'utf8')).toBe(
          'y'.repeat(2 * 1024 * 1024) + 'stderr-end',
        );
      }
      if (mode === 'write_error') {
        expect(result.stderr).toContain('EISDIR');
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
