import { test, expect } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { publish, keyJwt } from '../publish.ts';

function option(args: string[], name: string) {
  expect(args).toContain(name);
  return args[args.indexOf(name) + 1];
}

function assertCommand(args: string[], token: string | undefined, body: string) {
  expect(args.slice(0, 2)).toEqual(['gh', 'pr']);
  expect(token).toBe('installation-secret');
  expect(args.join(' ')).not.toContain('secret');
  expect(option(args, '--repo')).toBe('thkt/dotagents-workflow-trial');
  expect(option(args, '--base')).toBe('main');
  expect(option(args, '--head')).toBe('codex/test');
  if (args[2] === 'list') {
    expect(option(args, '--state')).toBe('open');
  } else {
    expect(option(args, '--title')).toBe('Title with spaces');
    expect(option(args, '--body-file')).toBe(body);
  }
}

for (const mode of [
  'create',
  'existing',
  'create_failed',
  'list_failed',
  'empty',
  'revoke_failed',
  'wrong_app',
] as const) {
  test(`publisher: ${mode}`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'publisher-test-'));
    try {
      const body = join(dir, 'body with spaces.md');
      await writeFile(body, mode === 'empty' ? '' : 'Reviewable body');
      const commands: { args: string[]; token: string | undefined }[] = [];
      const requests: { path: string; token: string; method: string; input: object | undefined }[] =
        [];
      const failure = Error(mode);
      let authenticated = false;
      const io = {
        authenticate: () => {
          authenticated = true;
          return 'jwt-secret';
        },
        api: async (
          path: string,
          token: string,
          method = 'GET',
          input?: object,
        ): Promise<unknown> => {
          requests.push({ path, token, method, input });
          if (path === '/installation/token') {
            if (mode === 'revoke_failed') {
              throw failure;
            }
            return null;
          }
          if (path === '/app') {
            return { id: mode === 'wrong_app' ? 0 : 4881432 };
          }
          if (path.endsWith('access_tokens')) {
            return { token: 'installation-secret' };
          }
          return { account: { login: 'thkt' } };
        },
        command: (args: string[], token?: string) => {
          commands.push({ args, token });
          if (args[2] === 'list') {
            if (mode === 'list_failed') {
              throw failure;
            }
            return mode === 'existing' ? 'https://example/pr/1\n' : '';
          }
          if (mode === 'create_failed') {
            throw failure;
          }
          return 'https://example/pr/2\n';
        },
      };
      const result = publish(
        ['--head', 'codex/test', '--title', 'Title with spaces', '--body-file', body],
        io,
      );
      if (mode === 'create' || mode === 'existing') {
        expect(await result).toBe(`https://example/pr/${mode === 'existing' ? 1 : 2}`);
      } else {
        const error: unknown = await result.then(
          () => undefined,
          (reason: unknown) => reason,
        );
        if (['empty', 'wrong_app'].includes(mode)) {
          expect(error).toBeInstanceOf(Error);
        } else {
          expect(error).toBe(failure);
        }
      }
      expect(authenticated).toBe(mode !== 'empty');
      const issued = !['empty', 'wrong_app'].includes(mode);
      expect(requests.filter(({ path }) => path.endsWith('access_tokens'))).toEqual(
        issued
          ? [
              {
                path: '/app/installations/160237952/access_tokens',
                token: 'jwt-secret',
                method: 'POST',
                input: {
                  repository_ids: [1362242696],
                  permissions: { pull_requests: 'write', contents: 'read', metadata: 'read' },
                },
              },
            ]
          : [],
      );
      expect(requests.filter(({ token }) => token !== 'jwt-secret')).toEqual(
        issued
          ? [
              {
                path: '/installation/token',
                token: 'installation-secret',
                method: 'DELETE',
                input: undefined,
              },
            ]
          : [],
      );
      const creates = ['create', 'create_failed', 'revoke_failed'].includes(mode);
      expect(commands.map(({ args }) => args[2])).toEqual([
        ...(issued ? ['list'] : []),
        ...(creates ? ['create'] : []),
      ]);
      for (const { args, token } of commands) {
        assertCommand(args, token, body);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}

test('publisher rejects a different signing key', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  expect(() => keyJwt(pem)).toThrow('Unexpected key fingerprint');
});
