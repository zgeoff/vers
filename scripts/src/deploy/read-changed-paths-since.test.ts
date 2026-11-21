import { expect, onTestFinished, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { updateEnv } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';
import { readGitEnv, runGit } from '@zgeoff/testing/git';
import { readChangedPathsSince } from './read-changed-paths-since';

async function setupTest() {
  // a git hook exports GIT_DIR and its siblings to every child process, and git honours them over
  // `cwd`, so under the pre-push gate the fixture commands and the reader would otherwise act on
  // the real repository
  for (const name of Object.keys(process.env).filter((key) => key.startsWith('GIT_'))) {
    updateEnv(name, undefined);
  }

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vers-changed-paths-'));

  onTestFinished(async () => {
    await fs.rm(root, { force: true, recursive: true });
  });

  const originDir = path.join(root, 'origin');

  await fs.mkdir(originDir);

  const gitEnv = readGitEnv(createTempDir('git-home').path);

  const git = async (args: ReadonlyArray<string>): Promise<string> => {
    const stdout = await runGit(originDir, gitEnv, args);

    return stdout.trim();
  };

  await git(['init', '-q', '-b', 'main']);

  return { root, originDir, git };
}

test('it lists both the old and the new path of a renamed file', async () => {
  const ctx = await setupTest();

  await fs.mkdir(path.join(ctx.originDir, 'services/api'), { recursive: true });
  await Bun.write(path.join(ctx.originDir, 'services/api/handler.ts'), 'export const a = 1;\n');
  await ctx.git(['add', '-A']);
  await ctx.git(['commit', '-q', '-m', 'add handler']);

  const baseSHA = await ctx.git(['rev-parse', 'HEAD']);

  await fs.mkdir(path.join(ctx.originDir, 'libs'));
  await ctx.git(['mv', 'services/api/handler.ts', 'libs/handler.ts']);
  await ctx.git(['commit', '-q', '-m', 'move handler']);

  expect(readChangedPathsSince(baseSHA, { cwd: ctx.originDir })).resolves.toStrictEqual([
    'libs/handler.ts',
    'services/api/handler.ts',
  ]);
});

test('it lists the changes in a blobless clone that cannot fetch file contents', async () => {
  const ctx = await setupTest();

  const cloneDir = path.join(ctx.root, 'clone');

  await Bun.write(
    path.join(ctx.originDir, 'handler.ts'),
    'export const a = 1;\nexport const b = 2;\n',
  );

  await ctx.git(['add', '-A']);
  await ctx.git(['commit', '-q', '-m', 'add handler']);

  const baseSHA = await ctx.git(['rev-parse', 'HEAD']);

  await ctx.git(['mv', 'handler.ts', 'route.ts']);

  await Bun.write(
    path.join(ctx.originDir, 'route.ts'),
    'export const a = 1;\nexport const b = 3;\n',
  );

  await ctx.git(['commit', '-q', '-am', 'rename handler']);
  await ctx.git(['config', 'uploadpack.allowFilter', 'true']);

  await ctx.git([
    '-c',
    'protocol.file.allow=always',
    'clone',
    '-q',
    '--filter=blob:none',
    '--no-checkout',
    `file://${ctx.originDir}`,
    cloneDir,
  ]);

  await ctx.git(['-C', cloneDir, 'remote', 'set-url', 'origin', path.join(ctx.root, 'gone')]);

  expect(readChangedPathsSince(baseSHA, { cwd: cloneDir })).resolves.toStrictEqual([
    'handler.ts',
    'route.ts',
  ]);
});

test('it lists the changes up to the head it is given in place of HEAD', async () => {
  const ctx = await setupTest();

  await Bun.write(path.join(ctx.originDir, 'handler.ts'), 'export const a = 1;\n');
  await ctx.git(['add', '-A']);
  await ctx.git(['commit', '-q', '-m', 'add handler']);

  const baseSHA = await ctx.git(['rev-parse', 'HEAD']);

  await Bun.write(path.join(ctx.originDir, 'route.ts'), 'export const b = 2;\n');
  await ctx.git(['add', '-A']);
  await ctx.git(['commit', '-q', '-m', 'add route']);
  await ctx.git(['branch', 'released']);
  await ctx.git(['checkout', '-q', baseSHA]);

  expect(
    readChangedPathsSince(baseSHA, { cwd: ctx.originDir, head: 'released' }),
  ).resolves.toStrictEqual(['route.ts']);
});
