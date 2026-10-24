import { expect, onTestFinished, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { updateEnv } from '@vers/test-utils/bun';
import { execa } from 'execa';
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
      { cwd: repoRoot, env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } },
    );

    return result.stdout.trim();
  };

  await runGit(['init', '--quiet', '--initial-branch=main']);

  return { repoRoot, runGit };
}

test('it reads the digests recorded at the ref, not the working tree', async () => {
  const ctx = await setupTest();

  const digestsDir = path.join(ctx.repoRoot, 'libs/game/content-version/src');

  await fs.mkdir(digestsDir, { recursive: true });
  await fs.writeFile(path.join(digestsDir, 'content-version-digests.json'), '{ "3": "aa11" }\n');
  await ctx.runGit(['add', '.']);
  await ctx.runGit(['commit', '--quiet', '-m', 'record content version 3']);
  await fs.writeFile(path.join(digestsDir, 'content-version-digests.json'), '{ "3": "bb22" }\n');

  const digests = await readRecordedDigestsAt('main', ctx.repoRoot);

  expect(digests).toStrictEqual({ '3': 'aa11' });
});

test('it reads no digests at a ref that predates the record', async () => {
  const ctx = await setupTest();

  await fs.writeFile(path.join(ctx.repoRoot, 'README.md'), 'vers\n');
  await ctx.runGit(['add', '.']);
  await ctx.runGit(['commit', '--quiet', '-m', 'start']);

  const digests = await readRecordedDigestsAt('main', ctx.repoRoot);

  expect(digests).toStrictEqual({});
});

test('it rejects a ref the repository does not have', async () => {
  const ctx = await setupTest();

  await fs.writeFile(path.join(ctx.repoRoot, 'README.md'), 'vers\n');
  await ctx.runGit(['add', '.']);
  await ctx.runGit(['commit', '--quiet', '-m', 'start']);

  expect(readRecordedDigestsAt('no-such-branch', ctx.repoRoot)).rejects.toThrow();
});

test('it rejects a record that is not a map of content versions to digests', async () => {
  const ctx = await setupTest();

  const digestsDir = path.join(ctx.repoRoot, 'libs/game/content-version/src');

  await fs.mkdir(digestsDir, { recursive: true });
  await fs.writeFile(path.join(digestsDir, 'content-version-digests.json'), '{ "3": 7 }\n');
  await ctx.runGit(['add', '.']);
  await ctx.runGit(['commit', '--quiet', '-m', 'record a malformed digest']);

  expect(readRecordedDigestsAt('main', ctx.repoRoot)).rejects.toMatchObject({ name: 'ZodError' });
});
