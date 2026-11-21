import { expect, onTestFinished, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { updateEnv } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';
import { readGitEnv, runGit } from '@zgeoff/testing/git';
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

  const gitEnv = readGitEnv(createTempDir('git-home').path);

  const git = async (args: ReadonlyArray<string>): Promise<void> => {
    await runGit(repoRoot, gitEnv, args);
  };

  await git(['init', '--quiet', '--initial-branch=main']);

  return { repoRoot, git };
}

test('it reads the short name of every local branch', async () => {
  const ctx = await setupTest();

  await ctx.git(['commit', '--quiet', '--allow-empty', '-m', 'start']);
  await ctx.git(['branch', 'feature/trail-map']);
  await ctx.git(['branch', 'fix-lantern']);

  const branches = await readLocalBranches(ctx.repoRoot);

  expect(branches).toStrictEqual(['feature/trail-map', 'fix-lantern', 'main']);
});

test('it reads no branches from a repository with no commits', async () => {
  const ctx = await setupTest();
  const branches = await readLocalBranches(ctx.repoRoot);

  expect(branches).toStrictEqual([]);
});
