import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { runnerTests } from '../../scripts/tests/support/runner.ts';

const requireTrial = createRequire(resolve(import.meta.dir, '../package.json'));
const modules = dirname(dirname(dirname(requireTrial.resolve('@playwright/test/package.json'))));
runnerTests('playwright', modules);
