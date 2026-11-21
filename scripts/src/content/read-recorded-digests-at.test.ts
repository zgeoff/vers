import { expect, onTestFinished, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { updateEnv } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';
import { readGitEnv, runGit } from '@zgeoff/testing/git';
import { readRecordedDigestsAt } from './read-recorded-digests-at';

async function setupTest() {
  // a git hook exports GIT_DIR and its siblings to every child process, and git honours them over
  // `cwd`, so under the pre-push gate the fixture commands and the reader would otherwise act on
  // the real repository
  for (const name of Object.keys(process.env).filter((key) => key.startsWith('GIT_'))) {
    updateEnv(name, undefined);
  }

  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vers-recorded-digests-'));

  onTestFinished(async () => {
    await fs.rm(repoRoot, { force: true, recursive: true });
  });

  const gitEnv = readGitEnv(createTempDir('git-home').path);

  const git = async (args: ReadonlyArray<string>): Promise<string> => {
    const stdout = await runGit(repoRoot, gitEnv, args);

    return stdout.trim();
  };

  await git(['init', '--quiet', '--initial-branch=main']);

  return { repoRoot, git };
}

test('it reads the digests recorded at the ref, not the working tree', async () => {
  const ctx = await setupTest();

  const digestsDir = path.join(ctx.repoRoot, 'libs/game/content-version/src');

  await fs.mkdir(digestsDir, { recursive: true });
  await fs.writeFile(path.join(digestsDir, 'content-version-digests.json'), '{ "3": "aa11" }\n');
  await ctx.git(['add', '.']);
  await ctx.git(['commit', '--quiet', '-m', 'record content version 3']);
  await fs.writeFile(path.join(digestsDir, 'content-version-digests.json'), '{ "3": "bb22" }\n');

  const digests = await readRecordedDigestsAt('main', ctx.repoRoot);

  expect(digests).toStrictEqual({ '3': 'aa11' });
});

test('it reads no digests at a ref that predates the record', async () => {
  const ctx = await setupTest();

  await fs.writeFile(path.join(ctx.repoRoot, 'README.md'), 'vers\n');
  await ctx.git(['add', '.']);
  await ctx.git(['commit', '--quiet', '-m', 'start']);

  const digests = await readRecordedDigestsAt('main', ctx.repoRoot);

  expect(digests).toStrictEqual({});
});

test('it rejects a ref the repository does not have', async () => {
  const ctx = await setupTest();

  await fs.writeFile(path.join(ctx.repoRoot, 'README.md'), 'vers\n');
  await ctx.git(['add', '.']);
  await ctx.git(['commit', '--quiet', '-m', 'start']);

  expect(readRecordedDigestsAt('no-such-branch', ctx.repoRoot)).rejects.toThrow();
});

test('it rejects a record that is not a map of content versions to digests', async () => {
  const ctx = await setupTest();

  const digestsDir = path.join(ctx.repoRoot, 'libs/game/content-version/src');

  await fs.mkdir(digestsDir, { recursive: true });
  await fs.writeFile(path.join(digestsDir, 'content-version-digests.json'), '{ "3": 7 }\n');
  await ctx.git(['add', '.']);
  await ctx.git(['commit', '--quiet', '-m', 'record a malformed digest']);

  expect(readRecordedDigestsAt('main', ctx.repoRoot)).rejects.toMatchObject({ name: 'ZodError' });
});
