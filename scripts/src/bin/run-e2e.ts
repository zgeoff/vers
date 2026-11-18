import path from 'node:path';
import { buildE2EArgv } from '../ci/build-e2e-argv';

// a shell would split the leg's Playwright flags only unquoted, which the workflow lint refuses.

const rootPath = path.resolve(import.meta.dirname, '../../..');
const argv = buildE2EArgv(process.env['E2E_PROJECTS'] ?? '');

const turbo = Bun.spawn([path.join(rootPath, 'node_modules/.bin/turbo'), ...argv], {
  cwd: rootPath,
  stdio: ['inherit', 'inherit', 'inherit'],
});

process.exitCode = await turbo.exited;
