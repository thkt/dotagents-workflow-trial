import { test, expect } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { geminiResponse, writingCandidate, reviewWriting, writingModel } from '../writing.ts';

const original = [
  { name: 'README.md', body: '商品は4件です。`CODEX_FLOW_RUNTIME_DIR`\n[手順](./steps.md)\n' },
];
const eventStream = (response: string, model = writingModel) =>
  [
    { event: 'init', init: { model } },
    { event: 'result', result: { status: 'SUCCESS', response } },
  ]
    .map((event) => JSON.stringify(event))
    .join('\n');

test('reject wrong model, missing completion and tool use', () => {
  expect(() => geminiResponse(eventStream('text', 'other-model'))).toThrow();
  expect(() =>
    geminiResponse('{"event":"init","init":{"model":"gemini-3.8-flash-high"}}'),
  ).toThrow();
  expect(() => geminiResponse(eventStream('text') + '\n{"event":"tool_call"}')).toThrow();
});

test('protected references and duplicate documents cannot be silently rewritten', () => {
  expect(() =>
    writingCandidate(
      JSON.stringify({ documents: [{ name: 'README.md', body: '商品は4件です。' }] }),
      original,
    ),
  ).toThrow();
  expect(() =>
    writingCandidate(JSON.stringify({ documents: [...original, ...original] }), original),
  ).toThrow();
  expect(writingCandidate(JSON.stringify({ documents: original }), original)).toEqual(original);
});

for (const accepted of [true, false]) {
  test(`separate fidelity decision controls adoption: ${accepted}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'writing-test-'));
    const dir = join(root, 'review');
    let calls = 0;
    const candidate = [
      {
        ...original[0],
        name: 'README.md',
        body: original[0]?.body.replace('4件', accepted ? '4件' : '5件') ?? '',
      },
    ];
    try {
      const action = () =>
        reviewWriting(original, '商品数は4件。', dir, async (argv, _cwd, input) => {
          calls++;
          if (argv[0] === 'agy') {
            return eventStream(JSON.stringify({ documents: candidate }));
          }
          expect(input).toContain('商品数は4件。');
          expect(input).toContain('candidate');
          return JSON.stringify({
            status: accepted ? 'accepted' : 'needs_changes',
            findings: accepted ? '数量と条件を保持' : '商品数を5件へ変更している',
          });
        });
      if (accepted) {
        expect(await action()).toEqual(candidate);
        expect(await readFile(join(dir, 'accepted.json'), 'utf8')).toContain(writingModel);
      } else {
        await rejected(action, 'did not accept');
        await rejected(() => readFile(join(dir, 'accepted.json')));
        expect(await readFile(join(dir, 'candidate.json'), 'utf8')).toContain('5件');
      }
      await rejected(action);
      expect(calls).toBe(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

async function rejected(action: () => Promise<unknown>, message = '') {
  let error: unknown;
  try {
    await action();
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(Error);
  if (message && error instanceof Error) {
    expect(error.message).toContain(message);
  }
}

test('changed documents or facts invalidate a successful review', async () => {
  const { reviewDocuments } = await import('../writing-review.ts');
  const { mkdir, writeFile, realpath } = await import('node:fs/promises');
  const { spawnSync } = await import('node:child_process');
  const root = await realpath(await mkdtemp(join(tmpdir(), 'writing-cache-')));
  const cwd = join(root, 'repo'),
    dir = join(root, 'evidence');
  await mkdir(cwd);
  await mkdir(dir);
  const git = (...args: string[]) => {
    expect(spawnSync('git', args, { cwd }).status).toBe(0);
  };
  git('init', '-q');
  git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '--allow-empty',
    '-m',
    'base',
  );
  let name = 'README.md';
  let file = join(cwd, name);
  let calls = 0;
  const runner = async (argv: string[]) => {
    calls++;
    if (argv[0] === 'agy') {
      return eventStream(
        JSON.stringify({
          documents: [
            {
              name,
              body: (await readFile(file, 'utf8')).replace('長い文章', '短い文'),
            },
          ],
        }),
      );
    }
    return JSON.stringify({ status: 'accepted', findings: '条件は同じ' });
  };
  try {
    await writeFile(file, '長い文章。4件です。');
    await reviewDocuments(cwd, '4件', dir, runner);
    expect(await readFile(file, 'utf8')).toBe('短い文。4件です。');
    await reviewDocuments(cwd, '4件', dir, runner);
    expect(calls).toBe(2);
    await writeFile(file, '長い文章。5件です。');
    await reviewDocuments(cwd, '5件', dir, runner);
    expect(calls).toBe(4);
    await reviewDocuments(cwd, '5件。新たな出典。', dir, runner);
    expect(calls).toBe(6);
    const retained = '保持する説明。\n'.repeat(30) + '短い文。5件です。\n';
    await writeFile(file, retained);
    git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'document');
    git('mv', 'README.md', 'renamed.md');
    name = 'renamed.md';
    file = join(cwd, name);
    await writeFile(file, retained + '追記。\n');
    git('add', '.');
    expect(
      spawnSync('git', ['diff', '--cached', '--name-status'], { cwd, encoding: 'utf8' }).stdout,
    ).toMatch(/^R/);
    await reviewDocuments(cwd, '5件。新たな出典。', dir, runner);
    expect(calls).toBe(8);
    await writeFile(file, '長い文章。5件です。\n追記。\nさらに追記。');
    let facts = '5件';
    await rejected(
      () =>
        reviewDocuments(
          cwd,
          facts,
          dir,
          async (...args) => {
            const output = await runner(args[0]);
            facts = '6件';
            return output;
          },
          async () => facts,
        ),
      'facts changed',
    );
    expect(await readFile(file, 'utf8')).toContain('長い文章');
    const before = calls;
    await writeFile(join(dir, 'active.json'), JSON.stringify({ phase: 'adopting' }));
    await writeFile(file, '短い文。5件です。');
    await rejected(() => reviewDocuments(cwd, facts, dir, runner), 'reconciliation');
    expect(calls).toBe(before);
    git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'adopted');
    await rejected(() => reviewDocuments(cwd, facts, dir, runner), 'reconciliation');
    expect(calls).toBe(before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
