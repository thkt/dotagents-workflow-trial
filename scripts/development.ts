import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { command, run, withInterrupts, parseReply, captureInstructions } from './correction.ts';
import { isRecord } from './input.ts';
import { publish } from './publish.ts';

const repository = 'thkt/dotagents-workflow-trial';
const runtime = { command, verify: run, publish };
const modelTimeMs = 1200000;

function issueNumber(input: string | undefined) {
  const raw = input?.replace(`https://github.com/${repository}/issues/`, '').replace(/^#/, '');
  assert(
    raw && /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)),
    'Supply an Issue number or a URL in the trial repository',
  );
  return raw;
}

async function checked(io: typeof runtime, argv: string[], cwd: string, prefix?: string) {
  const result = await io.command(argv, cwd, '', 540000, prefix);
  assert(result.code === 0 && !result.timedOut, `Command failed: ${argv[0]}; ${result.stderr}`);
  return result.stdout.trim();
}

function issueValue(text: string) {
  const value: unknown = JSON.parse(text);
  assert(
    isRecord(value) &&
      typeof value.title === 'string' &&
      value.title.trim() &&
      typeof value.body === 'string' &&
      value.body.trim() &&
      value.state === 'OPEN',
    'Issue must be open with a title and requirements',
  );
  return { title: value.title, body: value.body };
}

async function prepare(args: string[], io: typeof runtime) {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    options: {
      repo: { type: 'string' },
      'run-dir': { type: 'string' },
      'no-publish': { type: 'boolean' },
    },
  });
  assert(
    parsed.positionals.length === 1,
    'Usage: bun scripts/development.ts ISSUE [--repo CHECKOUT] [--run-dir DIRECTORY]',
  );
  const number = issueNumber(parsed.positionals[0]);
  const repo = await realpath(parsed.values.repo ?? process.cwd());
  const git = (...argv: string[]) => checked(io, ['git', ...argv], repo);
  const identity: unknown = JSON.parse(
    await checked(io, ['gh', 'repo', 'view', '--json', 'nameWithOwner'], repo),
  );
  assert(
    isRecord(identity) && identity.nameWithOwner === repository,
    'This publisher supports only the trial repository',
  );
  assert(
    (await git('status', '--porcelain')).length === 0,
    'Commit or preserve pending work before development; the entry uses committed HEAD',
  );
  const issue = [
    'gh',
    'issue',
    'view',
    number,
    '--repo',
    repository,
    '--json',
    'title,body,state,updatedAt',
  ];
  const original = await checked(io, issue, repo);
  const requirements = issueValue(original);
  const common = await realpath(
    await git('rev-parse', '--path-format=absolute', '--git-common-dir'),
  );
  const key = createHash('sha256').update(common).digest('hex').slice(0, 16);
  const dir = resolve(
    parsed.values['run-dir'] ?? join(homedir(), '.local/share/dotagents/development', key, number),
  );
  const outside = (parent: string, child: string) => {
    const path = relative(parent, child);
    return path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
  };
  assert(
    outside(repo, dir) && outside(common, dir),
    'Run directory must be outside checkout and Git storage',
  );
  await mkdir(resolve(dir, '..'), { recursive: true });
  await mkdir(dir); // Never reset an existing execution, budget, or uncertain publication.
  const canonical = await realpath(dir);
  assert(
    outside(repo, canonical) && outside(common, canonical),
    'Run directory resolves inside repository storage',
  );
  const base = await git('rev-parse', 'HEAD');
  const remote = await git('remote', 'get-url', 'origin');
  const cwd = join(dir, 'checkout');
  const branch = `codex/development-${number}`;
  await writeFile(join(dir, 'issue.json'), original);
  await git('worktree', 'add', '-b', branch, cwd, 'HEAD');
  return {
    number,
    repo,
    issue,
    original,
    requirements,
    dir,
    cwd,
    branch,
    base,
    remote,
    localOnly: parsed.values['no-publish'] ?? false,
  };
}
type Context = Awaited<ReturnType<typeof prepare>>;

async function implement(context: Context, io: typeof runtime) {
  const { cwd, dir, original } = context;
  await checked(
    io,
    ['bun', 'install', '--frozen-lockfile', '--ignore-scripts'],
    cwd,
    join(dir, 'install'),
  );
  await checked(io, ['bun', 'run', 'setup:e2e'], cwd, join(dir, 'browser'));
  const prompt = [
    'Implement the complete agreed Issue using existing code and verification assets. Read README.md, DEVELOPMENT.md and applicable repository instructions.',
    'Prepare meaningful tests, current documentation and capture definitions. The host runs browser tests and capture; do not launch browsers or servers in your sandbox.',
    captureInstructions,
    'Do not commit, push, publish, change the Issue or weaken acceptance criteria. Do not run the full check; the host will do it after implementation.',
    'Do not edit control scripts or credentials outside this checkout. If scope or authorization must change, return needs_human. Otherwise return repaired with a concrete summary.',
    `Requirements:\n${original}`,
  ].join('\n');
  await writeFile(join(dir, 'implementation.prompt'), prompt);
  const actor = [process.execPath, resolve(import.meta.dir, 'codex-actor.ts'), 'repair', dir];
  const result = await io.command(actor, cwd, prompt, modelTimeMs, join(dir, 'implementation'));
  await writeFile(
    join(dir, 'implementation.json'),
    JSON.stringify({ code: result.code, timedOut: result.timedOut, ms: result.ms }),
  );
  assert(!result.timedOut, `Initial implementation timed out; evidence: ${dir}`);
  assert(
    result.code === 0,
    `Initial implementation process failed (${result.code}); evidence: ${dir}`,
  );
  const reply = parseReply(result.stdout);
  assert(
    reply && ['repaired', 'needs_human'].includes(reply.status),
    `Invalid implementation reply; inspect ${dir}/implementation.stdout`,
  );
  await writeFile(join(dir, 'implementation-summary.md'), reply.findings);
  assert(
    reply.status !== 'needs_human',
    `Human decision required: ${reply.findings}; evidence: ${dir}`,
  );
  const remaining = modelTimeMs - result.ms;
  assert(remaining > 0, 'Model time limit reached');
  assert(
    (await checked(io, context.issue, cwd)) === original,
    'Requirements changed during implementation',
  );
  const config = {
    cwd,
    runDir: join(dir, 'verification'),
    issue: context.issue,
    check: ['bun', 'run', 'check'],
    capture: [process.execPath, resolve(import.meta.dir, 'capture.ts')],
    repair: actor,
    review: [process.execPath, resolve(import.meta.dir, 'codex-actor.ts'), 'review', dir],
    repairLimit: 2,
    reviewLimit: 2,
    modelTimeMs: remaining,
    checkTimeMs: 540000,
  };
  await writeFile(join(dir, 'verification-config.json'), JSON.stringify(config, null, 2));
  const resultState = await io.verify(config);
  assert(
    resultState.result === 'ready_for_human_review',
    `Verification stopped: ${resultState.result}. ${resultState.findings ?? ''} Evidence: ${config.runDir}`,
  );
  await writeFile(
    join(dir, 'verification-summary.md'),
    resultState.findings ?? 'Local check and independent review accepted the current deliverables.',
  );
  return config;
}

async function ship(
  context: Context,
  config: Awaited<ReturnType<typeof implement>>,
  io: typeof runtime,
) {
  const { cwd, dir, number, branch, requirements } = context;
  const git = (...args: string[]) => checked(io, ['git', ...args], cwd);
  assert(
    (await git('rev-parse', 'HEAD')) === context.base &&
      (await git('branch', '--show-current')) === branch &&
      (await git('remote', 'get-url', 'origin')) === context.remote,
    'Actor changed branch, HEAD or remote',
  );
  const changed = await git('status', '--porcelain');
  assert(changed.length > 0, 'No implementation changes; no PR created');
  // Reuse the controller's source/Issue check immediately before publication.
  assert(
    (await io.verify(config)).result === 'ready_for_human_review',
    'Verified source or requirements changed',
  );
  await git('add', '--all');
  await git('commit', '-m', `${requirements.title} (#${number})`);
  const commit = await git('rev-parse', 'HEAD');
  const files = (
    await git('diff-tree', '--no-commit-id', '--name-only', '--diff-filter=AM', '-z', '-r', 'HEAD')
  ).split('\0');
  const media = files.filter((file) =>
    /^trial\/evidence\/.*\.(png|jpg|jpeg|webp|mp4|webm)$/i.test(file),
  );
  const body = join(dir, 'pr.md');
  const summary = await readFile(join(dir, 'verification-summary.md'), 'utf8');
  await writeFile(
    body,
    `Closes #${number}\n\n${summary}\n\n対象commit: ${commit}\n\nローカルcheckと独立評価を完了。最新CI、人のレビュー・承認は別途確認する。\n`,
  );
  assert(
    (await io.verify(config)).result === 'ready_for_human_review',
    'Target changed before push',
  );
  await git('push', '-u', 'origin', branch);
  const url = await io.publish([
    '--head',
    branch,
    '--title',
    requirements.title,
    '--body-file',
    body,
  ]);
  await writeFile(join(dir, 'pr-url.txt'), url);
  if (media.length) {
    await checked(
      io,
      [
        'gh',
        'pr',
        'edit',
        url,
        '--repo',
        repository,
        ...media.flatMap((file) => ['--attach', resolve(cwd, file)]),
      ],
      cwd,
      join(dir, 'attachments'),
    );
  }
  const view = await checked(
    io,
    [
      'gh',
      'pr',
      'view',
      url,
      '--repo',
      repository,
      '--json',
      'url,headRefOid,baseRefName,state,body',
    ],
    cwd,
  );
  const pr: unknown = JSON.parse(view);
  assert(
    isRecord(pr) &&
      pr.url === url &&
      pr.headRefOid === commit &&
      pr.baseRefName === 'main' &&
      pr.state === 'OPEN' &&
      typeof pr.body === 'string' &&
      pr.body.includes(`Closes #${number}`),
    'Published PR does not match the verified commit',
  );
  await writeFile(join(dir, 'pr.json'), view);
  const ci = await io.command(
    ['gh', 'pr', 'checks', url, '--repo', repository, '--watch', '--interval', '10'],
    cwd,
    '',
    540000,
    join(dir, 'ci'),
  );
  const result = {
    url,
    commit,
    evidence: dir,
    ci: ci.code === 0 && !ci.timedOut ? 'passed' : 'pending_or_failed',
    remaining: ['human_review', ...(media.length ? ['rendered_media_check'] : [])],
  };
  await writeFile(join(dir, 'result.json'), JSON.stringify(result, null, 2));
  assert(result.ci === 'passed', `PR created but CI is not confirmed: ${url}; inspect ${dir}`);
  return result;
}

export async function develop(args: string[], io = runtime) {
  const context = await prepare(args, io);
  console.error(
    `Development #${context.number}; checkout: ${context.cwd}; evidence: ${context.dir}`,
  );
  try {
    console.error('Implementing, checking and independently reviewing the Issue');
    const config = await implement(context, io);
    if (context.localOnly) {
      return { status: 'verified_local', evidence: context.dir, checkout: context.cwd };
    }
    console.error('Verified; committing, publishing and checking CI');
    return await ship(context, config, io);
  } catch (error) {
    await writeFile(
      join(context.dir, 'stopped.txt'),
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

if (import.meta.main) {
  try {
    console.log(
      JSON.stringify(await withInterrupts(() => develop(process.argv.slice(2))), null, 2),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
