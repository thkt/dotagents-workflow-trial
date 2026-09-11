import { access, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { isRecord } from './input.ts';

// The controller owns the enclosing process group, timeout and output directory.
async function capture() {
  const output = process.argv[2];
  if (!output) {
    throw Error('Capture output directory is required');
  }
  const cwd = process.cwd();
  const spec = resolve(cwd, 'trial/capture.spec.js');
  try {
    await access(spec);
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
  process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
  try {
    await new Promise<void>((done, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () =>
        server.close((error) => (error ? reject(error) : done())),
      );
    });
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch();
    await browser.close();
  } catch (error) {
    console.error(
      'Host cannot start the browser/server; host operator must resolve this environment failure.',
      error,
    );
    process.exitCode = 78;
    return;
  }
  const root = dirname(output);
  const report = `${output}.report.json`;
  const config = `${output}.config.js`;
  const base = pathToFileURL(resolve(cwd, 'trial/playwright.config.js')).href;
  await writeFile(
    config,
    `import base from ${JSON.stringify(base)};
export default { ...base, testDir: ${JSON.stringify(resolve(cwd, 'trial'))}, testMatch: 'capture.spec.js',
  testIgnore: [], forbidOnly: true, retries: 0, repeatEach: 1, workers: 1,
  outputDir: ${JSON.stringify(`${output}.artifacts`)},
  reporter: [['json', {outputFile: ${JSON.stringify(report)}}]] };
`,
  );
  const cli = createRequire(resolve(cwd, 'package.json')).resolve('@playwright/test/cli');
  const child = spawn(process.execPath, [cli, 'test', '--config', config], {
    cwd,
    env: { ...process.env, CAPTURE_OUTPUT: output },
    stdio: 'inherit',
  });
  const code = await new Promise<number | null>((done, reject) => {
    child.once('error', reject);
    child.once('close', done);
  });
  if (code !== 0) {
    throw Error(`Capture failed; report: ${report}`);
  }
  const value: unknown = JSON.parse(await readFile(report, 'utf8'));
  if (
    !isRecord(value) ||
    !isRecord(value.stats) ||
    typeof value.stats.expected !== 'number' ||
    value.stats.expected <= 0 ||
    value.stats.skipped !== 0 ||
    value.stats.unexpected !== 0 ||
    value.stats.flaky !== 0 ||
    !Array.isArray(value.errors) ||
    value.errors.length
  ) {
    throw Error(`Capture must execute all registered tests successfully; report: ${report}`);
  }
  console.log(`Capture passed: ${value.stats.expected} tests; evidence: ${root}`);
}

try {
  await capture();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
