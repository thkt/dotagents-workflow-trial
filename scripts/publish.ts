import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { isRecord, isArray } from './input.ts';

const repo = 'thkt/dotagents-workflow-trial';
function command(argv: string[], token?: string): string {
  const [executable, ...args] = argv;
  assert(executable);
  const env = { ...process.env };
  delete env.GH_DEBUG;
  if (token) {
    env.GH_TOKEN = token;
  }
  const result = spawnSync(executable, args, { env, encoding: 'utf8', timeout: 120000 });
  assert(!result.error && result.status === 0, `Command failed: ${executable}`);
  return result.stdout;
}

export function keyJwt(pem: string): string {
  const key = createPrivateKey(pem);
  const publicKey = createPublicKey(key).export({ type: 'spki', format: 'der' });
  const fingerprint = createHash('sha256').update(publicKey).digest('base64');
  assert(
    fingerprint === 'j3DolAZcTa3JO6mnUyYzIdoS5+T5lt9rGedZ1hY+uqo=',
    'Unexpected key fingerprint',
  );
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: now - 60, exp: now + 300, iss: 'Iv23liEl9AuQXWekODVl' })}`;
  return `${payload}.${sign('RSA-SHA256', Buffer.from(payload), key).toString('base64url')}`;
}
function authenticate(): string {
  const stored = command([
    '/usr/bin/security',
    'find-generic-password',
    '-s',
    'thkt.dotagents-workflow-trial.github-app',
    '-a',
    '4881432',
    '-w',
    join(homedir(), 'Library/Keychains/login.keychain-db'),
  ]).trim();
  return keyJwt(stored.startsWith('-----BEGIN') ? stored : Buffer.from(stored, 'hex').toString());
}
async function api(path: string, token: string, method = 'GET', body?: object): Promise<unknown> {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  assert(response.ok, `GitHub ${path}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}
const runtime = { command, authenticate, api };

export async function publish(args: string[], io = runtime): Promise<string> {
  const { values } = parseArgs({
    args,
    options: {
      head: { type: 'string' },
      title: { type: 'string' },
      'body-file': { type: 'string' },
    },
    strict: true,
  });
  assert(
    values.head?.trim() && values.head !== 'main' && values.title?.trim() && values['body-file'],
    'Required: --head BRANCH --title TITLE --body-file PATH',
  );
  const head = values.head;
  const title = values.title;
  assert(head && title);
  const bodyFile = resolve(values['body-file']);
  assert((await readFile(bodyFile, 'utf8')).trim(), 'PR body must not be empty');
  const jwt = io.authenticate();
  const app = await io.api('/app', jwt);
  assert(isRecord(app) && app.id === 4881432, 'Unexpected App');
  const installation = await io.api('/app/installations/160237952', jwt);
  assert(
    isRecord(installation) &&
      isRecord(installation.account) &&
      installation.account.login === 'thkt',
    'Unexpected installation',
  );
  const issued = await io.api('/app/installations/160237952/access_tokens', jwt, 'POST', {
    repository_ids: [1362242696],
    permissions: { pull_requests: 'write', contents: 'read', metadata: 'read' },
  });
  assert(
    isRecord(issued) && typeof issued.token === 'string' && issued.token.length > 0,
    'Missing installation token',
  );
  const token = issued.token;
  try {
    const existing: unknown = JSON.parse(
      io.command(
        [
          'gh',
          'pr',
          'list',
          '--repo',
          repo,
          '--state',
          'open',
          '--head',
          head,
          '--base',
          'main',
          '--json',
          'url',
        ],
        token,
      ),
    );
    assert(isArray(existing), 'Invalid PR list');
    if (existing.length) {
      const first = existing[0];
      assert(isRecord(first) && typeof first.url === 'string', 'Invalid PR URL');
      return first.url;
    }
    return io
      .command(
        [
          'gh',
          'pr',
          'create',
          '--repo',
          repo,
          '--base',
          'main',
          '--head',
          head,
          '--title',
          title,
          '--body-file',
          bodyFile,
        ],
        token,
      )
      .trim();
  } finally {
    await io.api('/installation/token', token, 'DELETE');
  }
}

if (import.meta.main) {
  try {
    console.log(await publish(process.argv.slice(2)));
    console.log('Temporary installation token revoked.');
  } catch {
    console.error('Publish failed. Check arguments, App access and the PR state before retrying.');
    process.exitCode = 1;
  }
}
