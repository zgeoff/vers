import { expect, onTestFinished, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { updateEnv } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';
import { readGitEnv, runGit } from '@zgeoff/testing/git';
import { readCommitRelation } from './read-commit-relation';

async function setupTest() {
  // a git hook exports GIT_DIR and its siblings to every child process, and git honours them over
  // `cwd`, so under the pre-push gate the fixture commands and the reader would otherwise act on
  // the real repository
  for (const name of Object.keys(process.env).filter((key) => key.startsWith('GIT_'))) {
    updateEnv(name, undefined);
  }

  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'vers-commit-relation-'));

  onTestFinished(async () => {
    await fs.rm(cwd, { force: true, recursive: true });
  });

  const gitEnv = readGitEnv(createTempDir('git-home').path);

  const git = async (args: ReadonlyArray<string>): Promise<string> => {
    const stdout = await runGit(cwd, gitEnv, args);

    return stdout.trim();
  };

  await git(['init', '-q', '-b', 'main']);

  return { cwd, git };
}

test('it reports a commit HEAD descends from as an ancestor', async () => {
  const ctx = await setupTest();

  await ctx.git(['commit', '-q', '--allow-empty', '-m', 'a']);

  const ancestorSHA = await ctx.git(['rev-parse', 'HEAD']);

  await ctx.git(['commit', '-q', '--allow-empty', '-m', 'b']);

  expect(readCommitRelation(ancestorSHA, { cwd: ctx.cwd })).resolves.toBe('ancestor');
});

test('it reports a commit that descends from HEAD as a descendant', async () => {
  const ctx = await setupTest();

  await ctx.git(['commit', '-q', '--allow-empty', '-m', 'a']);
  await ctx.git(['commit', '-q', '--allow-empty', '-m', 'b']);

  const descendantSHA = await ctx.git(['rev-parse', 'HEAD']);

  await ctx.git(['checkout', '-q', 'HEAD~1']);

  expect(readCommitRelation(descendantSHA, { cwd: ctx.cwd })).resolves.toBe('descendant');
});

test('it reports HEAD itself as the same commit', async () => {
  const ctx = await setupTest();

  await ctx.git(['commit', '-q', '--allow-empty', '-m', 'a']);

  const headSHA = await ctx.git(['rev-parse', 'HEAD']);

  expect(readCommitRelation(headSHA, { cwd: ctx.cwd })).resolves.toBe('same');
});

test('it reports a commit on another branch as diverged', async () => {
  const ctx = await setupTest();

  await ctx.git(['commit', '-q', '--allow-empty', '-m', 'a']);
  await ctx.git(['commit', '-q', '--allow-empty', '-m', 'b']);

  const mainSHA = await ctx.git(['rev-parse', 'HEAD']);

  await ctx.git(['checkout', '-q', '-b', 'topic', 'HEAD~1']);
  await ctx.git(['commit', '-q', '--allow-empty', '-m', 'c']);

  expect(readCommitRelation(mainSHA, { cwd: ctx.cwd })).resolves.toBe('diverged');
});

test('it reports a commit the repository does not hold as missing', async () => {
  const ctx = await setupTest();

  await ctx.git(['commit', '-q', '--allow-empty', '-m', 'a']);

  expect(
    readCommitRelation('0123456789abcdef0123456789abcdef01234567', { cwd: ctx.cwd }),
  ).resolves.toBe('missing');
});

test('it relates the base to the head it is given in place of HEAD', async () => {
  const ctx = await setupTest();

  await ctx.git(['commit', '-q', '--allow-empty', '-m', 'a']);

  const baseSHA = await ctx.git(['rev-parse', 'HEAD']);

  await ctx.git(['commit', '-q', '--allow-empty', '-m', 'b']);
  await ctx.git(['branch', 'released']);
  await ctx.git(['checkout', '-q', baseSHA]);

  expect(readCommitRelation(baseSHA, { cwd: ctx.cwd, head: 'released' })).resolves.toBe('ancestor');
});
