import assert from 'node:assert/strict';
import { test, expect } from 'bun:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { develop } from '../development.ts';
import { command } from '../correction.ts';
import type { Config, State } from '../input.ts';

const issue = JSON.stringify({
  title: 'Make result visible',
  body: 'Show the requested result.',
  state: 'OPEN',
  updatedAt: '1',
});
async function rejected(action: () => Promise<unknown>) {
  let failed = false;
  try {
    await action();
  } catch {
    failed = true;
  }
  expect(failed).toBe(true);
}

async function checkActorStop(mode: string, dir: string, reviews: number) {
  const messages: Record<string, string> = {
    needs_human: 'Human decision required: Need agreement on scope',
    invalid_reply: 'Invalid implementation reply',
  };
  const message = messages[mode];
  if (message) {
    expect(await readFile(join(dir, 'stopped.txt'), 'utf8')).toContain(message);
    expect(reviews).toBe(0);
  }
}
function actorReply(mode: string) {
  return mode === 'invalid_reply'
    ? 'not JSON'
    : JSON.stringify({
        status: mode === 'needs_human' ? 'needs_human' : 'repaired',
        findings: 'Need agreement on scope',
      });
}

async function writingStub(argv: string[], mode: string) {
  if (mode === 'writing_failure') {
    return { ...ok(), code: 1 };
  }
  const input = argv[argv.indexOf('--input') + 1];
  const output = argv[argv.indexOf('--output') + 1];
  assert(input && output);
  await writeFile(output, await readFile(input, 'utf8'));
  return ok();
}

const ok = (stdout = '') => ({ code: 0, stdout, stderr: '', timedOut: false, ms: 1 });
async function git(cwd: string, ...args: string[]) {
  const result = await command(['git', ...args], cwd, '', 10000);
  expect(result.code).toBe(0);
  return result.stdout.trim();
}

for (const mode of [
  'success',
  'initial_failure',
  'needs_human',
  'invalid_reply',
  'timeout',
  'local_only',
  'review_failure',
  'requirements_changed',
  'source_changed',
  'ci_failure',
  'writing_failure',
  'wrong_repo',
  'dirty',
] as const) {
  test(`development ${mode}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'development-'));
    const repo = join(root, 'repo');
    const dir = join(root, 'run');
    await mkdir(repo);
    await git(repo, 'init');
    await git(repo, 'config', 'user.email', 'test@example.com');
    await git(repo, 'config', 'user.name', 'Test');
    await git(
      repo,
      'remote',
      'add',
      'origin',
      'https://github.com/thkt/dotagents-workflow-trial.git',
    );
    await writeFile(join(repo, 'result.txt'), 'old');
    await git(repo, 'add', '.');
    await git(repo, 'commit', '-m', 'base');
    const original = await git(repo, 'rev-parse', 'HEAD');
    if (mode === 'dirty') {
      await writeFile(join(repo, 'unrelated.txt'), 'retain');
    }
    let implementations = 0,
      reviews = 0,
      pushes = 0,
      publications = 0;
    async function github(argv: string[], cwd: string) {
      switch (`${argv[1]}/${argv[2]}`) {
        case 'repo/view':
          return ok(
            JSON.stringify({
              nameWithOwner: mode === 'wrong_repo' ? 'other/repo' : 'thkt/dotagents-workflow-trial',
            }),
          );
        case 'issue/view':
          return ok(
            mode === 'requirements_changed' && implementations
              ? issue.replace('visible', 'different')
              : issue,
          );
        case 'pr/checks':
          return { ...ok(), code: mode === 'ci_failure' ? 1 : 0 };
        case 'pr/view':
          return ok(
            JSON.stringify({
              url: 'https://github.com/thkt/dotagents-workflow-trial/pull/100',
              headRefOid: await git(cwd, 'rev-parse', 'HEAD'),
              baseRefName: 'main',
              state: 'OPEN',
              body: 'Closes #99',
            }),
          );
        default:
          throw Error('Unexpected gh call');
      }
    }
    const io = {
      command: async (
        argv: string[],
        cwd: string,
        input: string,
        timeout: number,
        prefix?: string,
      ) => {
        if (argv[1]?.endsWith('/writing-review.ts')) {
          return writingStub(argv, mode);
        }
        if (argv[0] === 'git' && argv[1] === 'push') {
          pushes++;
          return ok();
        }
        if (argv[0] === 'git') {
          return command(argv, cwd, input, timeout, prefix);
        }
        if (argv[0] === 'gh') {
          return github(argv, cwd);
        }
        if (argv[0] === 'bun') {
          return ok();
        }
        implementations++;
        expect(input).toContain('Show the requested result.');
        await writeFile(join(cwd, 'result.txt'), 'implemented');
        return {
          ...ok(actorReply(mode)),
          code: mode === 'initial_failure' ? 1 : 0,
          ms: 500,
          timedOut: mode === 'timeout',
        };
      },
      verify: async (config: Config): Promise<State> => {
        reviews++;
        expect(config.capture?.[1]).toEndWith('/capture.ts');
        expect(config.modelTimeMs).toBe(1200000 - 500);
        expect(await readFile(join(config.cwd, 'result.txt'), 'utf8')).toBe('implemented');
        return {
          configHash: '',
          issueHash: '',
          repair: 0,
          review: 1,
          checks: 1,
          modelMs: 1,
          active: null,
          events: [],
          findings: 'Verified current implementation and media',
          result:
            mode === 'review_failure'
              ? 'review_failed'
              : mode === 'source_changed' && reviews > 1
                ? 'target_changed_after_stop'
                : 'ready_for_human_review',
        };
      },
      publish: async () => {
        publications++;
        expect(pushes).toBe(1);
        expect(reviews).toBeGreaterThanOrEqual(2);
        return 'https://github.com/thkt/dotagents-workflow-trial/pull/100';
      },
    };
    try {
      const args = ['99', '--repo', repo, '--run-dir', dir];
      if (mode === 'local_only') {
        const result = await develop([...args, '--no-publish'], io);
        assert('status' in result);
        expect(result.status).toBe('verified_local');
        expect(pushes).toBe(0);
        expect(publications).toBe(0);
      } else if (mode === 'success') {
        const result = await develop(args, io);
        assert('ci' in result);
        expect(result.ci).toBe('passed');
        expect(result.url).toContain('/pull/100');
        expect(publications).toBe(1);
        const body = await readFile(join(dir, 'pr.md'), 'utf8');
        expect(body).toContain('Verified current implementation and media');
        expect(body).not.toContain('Need agreement on scope');
        await rejected(() => develop(args, io));
        expect(implementations).toBe(1);
        expect(publications).toBe(1);
      } else {
        await rejected(() => develop(args, io));
        expect(publications).toBe(mode === 'ci_failure' ? 1 : 0);
        expect(pushes).toBe(mode === 'ci_failure' ? 1 : 0);
        await checkActorStop(mode, dir, reviews);
        if (mode === 'ci_failure') {
          expect(await readFile(join(dir, 'pr-url.txt'), 'utf8')).toContain('/pull/100');
        }
      }
      expect(await git(repo, 'rev-parse', 'HEAD')).toBe(original);
      expect(await readFile(join(repo, 'result.txt'), 'utf8')).toBe('old');
      if (mode === 'dirty') {
        expect(await readFile(join(repo, 'unrelated.txt'), 'utf8')).toBe('retain');
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
