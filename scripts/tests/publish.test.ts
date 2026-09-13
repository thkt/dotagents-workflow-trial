import { test, expect } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
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

test('publisher CLI reports the stop reason before touching credentials', () => {
  const result = spawnSync(process.execPath, [resolve(import.meta.dir, '../publish.ts')], {
    encoding: 'utf8',
    timeout: 10000,
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'Publish failed: Required: --head BRANCH --title TITLE --body-file PATH.',
  );
});

test('publisher rejects a different signing key', () => {
  // Public test fixture only; never used for authentication.
  const pem = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDIqyBPA9TwUXSg
h+o/z/Csr9mjtfP1oQhGGwvzO4nzfiNAvLFiw5MV1OVoaQSfWKHMh35+XHdti7bL
Ya6FdS77/K8mFGxI+Gs8WmQQ0vtq6LwtjHasCfwZ3QmcbXW/BVRQy/Oh3tMEzMRE
p9V9vpovQ8vuH2/+4v9eBTM0hisW1RJwPx7B+BbBji0snLx988lEHYwfjvYKXwqB
vI88b/6yEKYyycIv2ptaPi+qlku8AV4oKSsIIm8PdRpP89Mp9Zd3Rd2o4BqMt3tp
4sq+Qu3leN5e3iMkRWIJnzQxKbZxKX4Rb/Le79pYRbNrkXqP1CH8N4Lq5SNw0Y9D
wzKER0tTAgMBAAECggEALfl++ntvQuv2o3zgP2R9yKK1Y1uhnCobwiwaLcz7Sy0g
GInivjT+subG9IfzBisBTuHQKlU3C4MSC0DDAlKZxCPdYQUW1hUMRJSVDoG4FoNh
8bGX0syq1KYeuJcfffdTnPtNQ03Q3O2pHe2x7RBJNQD8bP8I4sXRKhJY6/S9VIpu
xWKLqdInsuRr27XHNHm8NiXjDm4dFR4n/MvpQKngAlJC1304T73L+9GITkZxiRA0
eDQX2VfKVBwROie4/y5UevkLTA2XuPfa07+UP31PhyTCgT10rP0DpQBAfi4mvPjT
mWsJoVM4iQaRUo/GQ3x02cBFB6EOvNY05ZWAyPgnaQKBgQDk55K44URihrDfmcjc
lnPmUko17el9IbSDGp5mVdNL+BgzabMnq4n9sUp5vMH64zVEDtKnquenigzyIry+
03VniJrq9hF9J2jllhIJ/hSmBRRwpWqL8CJU8Xu9J9/dPiBCzCytmUmtteuhOScL
OrwtNFSirOSlGIN9DYu4j83pRQKBgQDga+wg7D9mVFWkupxPthubIjXuX5eaKzCN
3YvScxCOThwqH9GStXM21x0SJ1eMyOCagn2J8BnlceU1y6Qb8ZQXBIQ06uKZzkWJ
EGLEEv+QhGebF+yTfw7nnnUJ+sSs3kXVSumSXT+Sd6QLHoAKLC3krrOvtCMh0YdY
aJvKQCiPtwKBgDaFmgMDVQCKyHJZ9OflxjFkBF0YD/dIIfDgVD5Xzv5XV5xXXt7i
EvokUnLwrNuPZs6RIUfig076qN67u21QfLRua0fv2HaQ/oFA34cVx+FLcHTsUZaH
WgYVhr2lU8Mk2xZN/45R5qTDoh5CuLQKB2xU/JvKxqM0VY1hvpf1WLxpAoGBAM7O
hS2dp5r78mQ31x2ZmnzuHLbK/mCCll7VHylTAZmxn0CuS6kfbsnFl7OH76T75AZe
Y6N+T87hkzBstZFOoIJJli9RmHnV3Lw/DlTTkRCzAuqoNEmDl8+XdRE6No160u2H
+A/5wECP4eqhM6qsJaqL12f93zYl6MxuscnCL96nAoGAd9ffsobymQ+tCLxRsMqs
5JzGHQhaE75Dta1U+d+X+GPtFnHg2LQH+7rnAamprSEad+kzwTIR2gsGQHRTrzEu
aGOepTSrB6f+J6uO53AafZ7ikStUF2Lc3hitfCvt+hGWfxR4zHF4R2xyXCmJkHWo
thkz0ySsOGLbM1YhyyhO6FQ=
-----END PRIVATE KEY-----
`;
  expect(() => keyJwt(pem)).toThrow('Unexpected key fingerprint');
});
