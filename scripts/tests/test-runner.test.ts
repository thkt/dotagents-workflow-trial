import { test, expect } from 'bun:test';
import { mkdtemp, mkdir, writeFile, symlink, rm, readdir } from 'node:fs/promises';
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
        const temporaryReports = join(cwd, 'temporary-reports');
        await mkdir(temporaryReports);
        const dir = join(cwd, runner === 'bun' ? 'scripts/tests' : 'trial/tests');
        await mkdir(dir, { recursive: true });
        await symlink(modules, join(cwd, 'node_modules'));
        await writeFile(join(cwd, 'package.json'), '{"type":"module"}');
        await mkdir(join(cwd, 'trial'), { recursive: true });
        await writeFile(
          join(cwd, 'trial/playwright.config.js'),
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
          env: { ...process.env, CI: 'false', TMPDIR: temporaryReports },
        });
        if (runner === 'bun') {
          expect(await readdir(temporaryReports)).toEqual([]);
        }
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

// Keep the runner's format valid so each case reaches the intended summary rule.
for (const { name, bun, playwright } of [
  {
    name: 'missing summary',
    bun: ['<?xml version="1.0"?><report/>', 'Missing or incomplete Bun JUnit summary'],
    playwright: ['{}', 'Missing Playwright stats'],
  },
  {
    name: 'missing total',
    bun: ['<?xml version="1.0"?><testsuites skipped="0"></testsuites>', 'No completed tests'],
    playwright: ['{"stats":{"skipped":0}}', 'No completed tests'],
  },
  {
    name: 'missing skipped count',
    bun: [
      '<?xml version="1.0"?><testsuites tests="1"></testsuites>',
      'Unexecuted tests or invalid skipped count: undefined',
    ],
    playwright: [
      '{"stats":{"expected":1}}',
      'Unexecuted tests or invalid skipped count: undefined',
    ],
  },
] as const) {
  test(`reports reject ${name}`, () => {
    expect(() => checkReport('bun', bun[0])).toThrow(bun[1]);
    expect(() => checkReport('playwright', playwright[0])).toThrow(playwright[1]);
  });
}

test('reports reject truncated output', () => {
  expect(() =>
    checkReport('bun', '<?xml version="1.0"?><testsuites tests="1" skipped="0">'),
  ).toThrow('Missing or incomplete Bun JUnit summary');
  expect(() => checkReport('playwright', '{"stats":{"expected":1,"skipped":0}')).toThrow(
    SyntaxError,
  );
});
