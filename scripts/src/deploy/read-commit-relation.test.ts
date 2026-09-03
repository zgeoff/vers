import { expect, onTestFinished, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { readCommitRelation } from './read-commit-relation';

async function setupTest() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'vers-commit-relation-'));

  onTestFinished(async () => {
    await fs.rm(cwd, { force: true, recursive: true });
  });

  const runGit = async (args: ReadonlyArray<string>): Promise<string> => {
    const result = await execa(
      'git',
      [
        '-c',
        'user.name=test',
        '-c',
        'user.email=test@vers.test',
        '-c',
        'commit.gpgsign=false',
        ...args,
      ],
      { cwd, env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } },
    );

    return result.stdout.trim();
  };

  await runGit(['init', '-q', '-b', 'main']);

  return { cwd, runGit };
}

test('it reports a commit HEAD descends from as an ancestor', async () => {
  const ctx = await setupTest();

  await ctx.runGit(['commit', '-q', '--allow-empty', '-m', 'a']);

  const a = await ctx.runGit(['rev-parse', 'HEAD']);

  await ctx.runGit(['commit', '-q', '--allow-empty', '-m', 'b']);

  expect(readCommitRelation(a, { cwd: ctx.cwd })).resolves.toBe('ancestor');
});

test('it reports a commit that descends from HEAD as a descendant', async () => {
  const ctx = await setupTest();

  await ctx.runGit(['commit', '-q', '--allow-empty', '-m', 'a']);
  await ctx.runGit(['commit', '-q', '--allow-empty', '-m', 'b']);

  const b = await ctx.runGit(['rev-parse', 'HEAD']);

  await ctx.runGit(['checkout', '-q', 'HEAD~1']);

  expect(readCommitRelation(b, { cwd: ctx.cwd })).resolves.toBe('descendant');
});

test('it reports HEAD itself as the same commit', async () => {
  const ctx = await setupTest();

  await ctx.runGit(['commit', '-q', '--allow-empty', '-m', 'a']);

  const a = await ctx.runGit(['rev-parse', 'HEAD']);

  expect(readCommitRelation(a, { cwd: ctx.cwd })).resolves.toBe('same');
});

test('it reports a commit on another branch as diverged', async () => {
  const ctx = await setupTest();

  await ctx.runGit(['commit', '-q', '--allow-empty', '-m', 'a']);
  await ctx.runGit(['commit', '-q', '--allow-empty', '-m', 'b']);

  const b = await ctx.runGit(['rev-parse', 'HEAD']);

  await ctx.runGit(['checkout', '-q', '-b', 'topic', 'HEAD~1']);
  await ctx.runGit(['commit', '-q', '--allow-empty', '-m', 'c']);

  expect(readCommitRelation(b, { cwd: ctx.cwd })).resolves.toBe('diverged');
});

test('it reports a commit the repository does not hold as missing', async () => {
  const ctx = await setupTest();

  await ctx.runGit(['commit', '-q', '--allow-empty', '-m', 'a']);

  expect(
    readCommitRelation('0123456789abcdef0123456789abcdef01234567', { cwd: ctx.cwd }),
  ).resolves.toBe('missing');
});
