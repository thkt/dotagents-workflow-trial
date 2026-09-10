import { test, expect } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { publish, keyJwt } from '../publish.ts';

for (const mode of [
  'create',
  'existing',
  'create_failed',
  'list_failed',
  'empty',
  'invalid_list',
  'revoke_failed',
  'wrong_app',
] as const) {
  test(`publisher: ${mode}`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'publisher-test-'));
    try {
      const body = join(dir, 'body with spaces.md');
      await writeFile(body, mode === 'empty' ? '' : 'Reviewable body');
      const commands: string[][] = [];
      const requests: string[] = [];
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
          requests.push(path);
          if (path === '/installation/token') {
            expect(method).toBe('DELETE');
            expect(token).toBe('installation-secret');
            if (mode === 'revoke_failed') {
              throw Error('revocation failed');
            }
            return null;
          }
          expect(token).toBe('jwt-secret');
          if (path === '/app') {
            return { id: mode === 'wrong_app' ? 0 : 4881432 };
          }
          if (path.endsWith('access_tokens')) {
            expect(input).toEqual({
              repository_ids: [1362242696],
              permissions: { pull_requests: 'write', contents: 'read', metadata: 'read' },
            });
            return { token: 'installation-secret' };
          }
          return { account: { login: 'thkt' } };
        },
        command: (args: string[], token?: string) => {
          commands.push(args);
          expect(token).toBe('installation-secret');
          expect(args.join(' ')).not.toContain('secret');
          if (args[2] === 'list') {
            if (mode === 'list_failed') {
              throw Error('list failed');
            }
            if (mode === 'invalid_list') {
              return '{}';
            }
            return mode === 'existing' ? '[{"url":"https://example/pr/1"}]' : '[]';
          }
          expect(args).toEqual([
            'gh',
            'pr',
            'create',
            '--repo',
            'thkt/dotagents-workflow-trial',
            '--base',
            'main',
            '--head',
            'codex/test',
            '--title',
            'Title with spaces',
            '--body-file',
            body,
          ]);
          if (mode === 'create_failed') {
            throw Error('create failed');
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
        expect(
          await result.then(
            () => false,
            () => true,
          ),
        ).toBe(true);
      }
      expect(authenticated).toBe(mode !== 'empty');
      expect(requests.includes('/installation/token')).toBe(!['empty', 'wrong_app'].includes(mode));
      expect(commands.filter((args) => args[2] === 'create').length).toBe(
        ['create', 'create_failed', 'revoke_failed'].includes(mode) ? 1 : 0,
      );
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
