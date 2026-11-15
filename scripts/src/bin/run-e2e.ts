import path from 'node:path';
import { buildE2EArgv } from '../ci/build-e2e-argv';

// Runs the main pipeline's e2e leg through turbo, with the leg's Playwright flags from
// E2E_PROJECTS. A shell would split them only unquoted, which the workflow lint refuses.

const rootPath = path.resolve(import.meta.dirname, '../../..');
const argv = buildE2EArgv(process.env['E2E_PROJECTS'] ?? '');

const turbo = Bun.spawn([path.join(rootPath, 'node_modules/.bin/turbo'), ...argv], {
  cwd: rootPath,
  stdio: ['inherit', 'inherit', 'inherit'],
});

process.exitCode = await turbo.exited;
