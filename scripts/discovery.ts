import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rename, rm, realpath, readdir } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep, join, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { isRecord, isArray } from './input.ts';
import { nonempty, criteria, assessment, session, ready } from './discovery-input.ts';
import type { Session } from './discovery-input.ts';

async function json(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}
function outside(parent: string, child: string) {
  const path = relative(parent, child);
  return path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
}
async function save(dir: string, state: Session) {
  const temporary = join(dir, 'state.json.tmp');
  await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { flag: 'wx' });
  await rename(temporary, join(dir, 'state.json'));
}
async function start(file: string) {
  const config = await json(file);
  assert(isRecord(config), 'Invalid configuration');
  nonempty(config.repo);
  nonempty(config.contextDir);
  nonempty(config.task);
  nonempty(config.request);
  nonempty(config.criteriaFile);
  assert(/^[a-z0-9][a-z0-9-]*$/.test(config.task), 'Invalid task ID');
  assert(
    isAbsolute(config.repo) && isAbsolute(config.contextDir) && isAbsolute(config.criteriaFile),
    'Configuration paths must be absolute',
  );
  assert(isArray(config.referencePaths), 'Invalid referencePaths');
  const repo = await realpath(config.repo);
  const referencePaths = config.referencePaths.map((path) => {
    nonempty(path);
    assert(
      !isAbsolute(path) && !outside(repo, resolve(repo, path)),
      'Reference must be repo-relative',
    );
    return path;
  });
  assert(outside(repo, resolve(config.contextDir)), 'Context must be outside the checkout');
  const rules = await json(config.criteriaFile);
  criteria(rules);
  await mkdir(config.contextDir, { recursive: true });
  const contextDir = await realpath(config.contextDir);
  assert(outside(repo, contextDir), 'Context must be outside the checkout');
  const binding = join(contextDir, 'repository.txt');
  try {
    await writeFile(binding, repo, { flag: 'wx' });
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
      throw error;
    }
    assert((await readFile(binding, 'utf8')) === repo, 'Context belongs to another checkout');
  }
  const work = join(contextDir, 'work');
  await mkdir(work, { recursive: true });
  assert((await realpath(work)) === work, 'Work storage must not be a symlink');
  const dir = join(contextDir, 'work', config.task);
  await mkdir(dir);
  const state: Session = {
    repo,
    contextDir,
    referencePaths,
    request: config.request,
    criteria: rules,
    revision: 0,
    assessment: null,
    question: null,
    entries: [],
  };
  await save(dir, state);
  console.log(dir);
}
async function assess(state: Session, file: string) {
  assert(state.question === null, 'Answer the pending question before reassessment');
  const value = await json(file);
  assessment(value, state.criteria);
  assert(value.revision === state.revision, 'Stale assessment; read current status');
  state.entries.push({ kind: 'assessment', text: JSON.stringify(value) });
  state.revision++;
  state.assessment = value;
  state.question = value.question ? { id: randomUUID(), text: value.question } : null;
}
async function answer(state: Session, file: string) {
  const value = await json(file);
  assert(isRecord(value) && state.question !== null, 'No pending question');
  assert(value.questionId === state.question.id, 'Stale or unrelated answer');
  nonempty(value.text);
  state.entries.push({
    kind: 'answer',
    text: JSON.stringify({ question: state.question, answer: value.text }),
  });
  state.revision++;
  state.question = null;
  state.assessment = null;
}
async function note(state: Session, file: string) {
  const text = await readFile(file, 'utf8');
  nonempty(text);
  state.entries.push({ kind: 'note', text });
  state.revision++;
  state.assessment = null;
}
async function archive(state: Session, file: string, sessionDir: string) {
  assert(ready(state), 'Context is not sufficient');
  const text = await readFile(file, 'utf8');
  nonempty(text);
  const content = `Session: ${sessionDir}\nRevision: ${state.revision}\n\n${text}`;
  const id = createHash('sha256').update(content).digest('hex');
  const dir = join(state.contextDir, 'research');
  await mkdir(dir, { recursive: true });
  assert((await realpath(dir)) === dir, 'Research storage must not be a symlink');
  const path = join(dir, `${id}.md`);
  try {
    await writeFile(path, content, { flag: 'wx' });
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
      throw error;
    }
    assert((await readFile(path, 'utf8')) === content, 'Research record differs');
  }
  console.log(path);
}
async function load(dir: string) {
  const state = await json(join(dir, 'state.json'));
  session(state);
  assert(dirname(dirname(dir)) === state.contextDir, 'Session storage mismatch');
  assert((await realpath(state.repo)) === state.repo, 'Checkout changed');
  return state;
}
async function run(action: string, dir: string, file?: string) {
  const canonical = await realpath(dir);
  if (action === 'status') {
    console.log(JSON.stringify(await load(canonical), null, 2));
    return;
  }
  const lock = join(canonical, 'lock');
  await mkdir(lock);
  try {
    assert(
      !(await readdir(canonical)).includes('state.json.tmp'),
      'Unfinished save; reconcile session before continuing',
    );
    const current = await load(canonical);
    if (action === 'gate') {
      assert(ready(current), 'Context is not sufficient; inspect status');
      console.log(current.assessment?.decision);
      return;
    }
    nonempty(file);
    if (action === 'archive') {
      await archive(current, file, canonical);
      return;
    }
    if (action === 'assess') {
      await assess(current, file);
    } else if (action === 'answer') {
      await answer(current, file);
    } else {
      await note(current, file);
    }
    await save(canonical, current);
    console.log(
      JSON.stringify({
        revision: current.revision,
        ready: ready(current),
        question: current.question,
      }),
    );
  } finally {
    await rm(lock, { recursive: true });
  }
}
try {
  const [action, target, file, extra] = process.argv.slice(2);
  assert(
    action &&
      ['start', 'status', 'gate', 'note', 'assess', 'answer', 'archive'].includes(action) &&
      target &&
      !extra,
    'Usage: bun scripts/discovery.ts start CONFIG | status|gate SESSION | note|assess|answer|archive SESSION INPUT',
  );
  if (action === 'start') {
    assert(!file, 'Unexpected argument');
    await start(target);
  } else {
    assert(!['status', 'gate'].includes(action) || !file, 'Unexpected argument');
    await run(action, target, file);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
