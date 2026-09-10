import { test, expect } from 'bun:test';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkReport } from '../test.ts';

const entry = resolve(import.meta.dir, '../test.ts');
const modules = resolve(import.meta.dir, '../../node_modules');
for (const runner of ['bun', 'playwright'] as const) {
  for (const scenario of [
    'normal',
    'only',
    'skip',
    'conditional',
    'todo',
    'failure',
    'empty',
  ] as const) {
    test(`${runner} runner: ${scenario}`, async () => {
      const cwd = await mkdtemp(join(tmpdir(), 'test-completion-'));
      try {
        const dir = join(cwd, runner === 'bun' ? 'scripts/tests' : 'tests');
        await mkdir(dir, { recursive: true });
        await symlink(modules, join(cwd, 'node_modules'));
        await writeFile(join(cwd, 'package.json'), '{"type":"module"}');
        await writeFile(
          join(cwd, 'playwright.config.js'),
          "export default {testDir:'./tests', outputDir:'./artifacts/results'};",
        );
        const bodies = {
          normal: "test('second', () => expect(1).toBe(1));",
          only: "test.only('second', () => expect(1).toBe(1));",
          skip: "test.skip('second', () => expect(1).toBe(2));",
          conditional:
            runner === 'bun'
              ? "test.skipIf(true)('second', () => expect(1).toBe(2));"
              : "test('second', () => { test.skip(true); expect(1).toBe(2); });",
          todo:
            runner === 'bun'
              ? "test.todo('second');"
              : "test.fixme('second', () => expect(1).toBe(2));",
          failure: "test('second', () => expect(1).toBe(2));",
          empty: '',
        };
        const source =
          scenario === 'empty'
            ? ''
            : `import {test,expect} from '${runner === 'bun' ? 'bun:test' : '@playwright/test'}';
          test('first', () => expect(1).toBe(1)); ${bodies[scenario]}`;
        await writeFile(join(dir, 'probe.test.js'), source);
        const result = spawnSync(process.execPath, [entry, runner], {
          cwd,
          encoding: 'utf8',
          timeout: 15000,
          env: { ...process.env, CI: 'false' },
        });
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(scenario === 'normal' ? 0 : 1);
        if (scenario === 'skip' || scenario === 'conditional' || scenario === 'todo') {
          expect(result.stderr).toContain('Unexecuted tests');
        }
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    }, 20000);
  }
}

for (const runner of ['bun', 'playwright'] as const) {
  for (const content of ['', '{}', '<testsuites tests="1" skipped="0">']) {
    test(`${runner} rejects missing or incomplete summary: ${content}`, () => {
      expect(() => checkReport(runner, content)).toThrow();
    });
  }
}
