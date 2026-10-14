import { existsSync } from 'node:fs';
import { planRelatedTests } from '../git-hooks/plan-related-tests';

// bun reads bunfig.toml from its cwd only, so each package's tests run from that package's
// directory to get its preload.

const runs = planRelatedTests(process.argv.slice(2), (repoPath) => existsSync(repoPath));

if (runs.length === 0) {
  console.log('test-related: no related tests');
  process.exit(0);
}

let failed = false;

for (const run of runs) {
  const child = Bun.spawn(['bun', 'test', ...run.testPaths], {
    cwd: run.packageDir,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  if ((await child.exited) !== 0) {
    failed = true;
  }
}

const exitCode = failed ? 1 : 0;

process.exit(exitCode);
