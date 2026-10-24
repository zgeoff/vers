import { expect, onTestFinished, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { updateEnv } from '@vers/test-utils/bun';
import { $ } from 'bun';
import { readLocalBranches } from './read-local-branches';

async function setupTest() {
  // a git hook exports GIT_DIR and its siblings to every child process, and git honours them over
  // `cwd`, so under the pre-push gate the fixture commands and the reader would otherwise act on
  // the real repository
  for (const name of Object.keys(process.env).filter((key) => key.startsWith('GIT_'))) {
    updateEnv(name, undefined);
  }

  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vers-local-branches-'));

  onTestFinished(async () => {
    await fs.rm(repoRoot, { force: true, recursive: true });
  });

  const runGit = async (args: ReadonlyArray<string>): Promise<void> => {
    await $`git -c user.name=test -c user.email=test@vers.test -c commit.gpgsign=false ${args}`
      .cwd(repoRoot)
      .env({ ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' })
      .quiet();
  };

  await runGit(['init', '--quiet', '--initial-branch=main']);

  return { repoRoot, runGit };
}

test('it reads the short name of every local branch', async () => {
  const ctx = await setupTest();

  await ctx.runGit(['commit', '--quiet', '--allow-empty', '-m', 'start']);
  await ctx.runGit(['branch', 'feature/trail-map']);
  await ctx.runGit(['branch', 'fix-lantern']);

  const branches = await readLocalBranches(ctx.repoRoot);

  expect(branches).toStrictEqual(['feature/trail-map', 'fix-lantern', 'main']);
});

test('it reads no branches from a repository with no commits', async () => {
  const ctx = await setupTest();
  const branches = await readLocalBranches(ctx.repoRoot);

  expect(branches).toStrictEqual([]);
});
