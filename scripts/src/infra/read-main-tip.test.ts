import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateEnv } from '@vers/test-utils/bun';
import { $ } from 'bun';
import { readMainTip } from './read-main-tip';

async function setupTest() {
  // a git hook exports GIT_DIR and its siblings to every child process, and git honours them over
  // `cwd` and `-C`, so under the pre-push gate the fixture commands and the reader would otherwise
  // act on the real repository
  for (const name of Object.keys(process.env).filter((key) => key.startsWith('GIT_'))) {
    updateEnv(name, undefined);
  }

  updateEnv('GIT_CONFIG_GLOBAL', '/dev/null');
  updateEnv('GIT_CONFIG_NOSYSTEM', '1');

  const directory = await mkdtemp(join(tmpdir(), 'main-tip-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  const remotePath = join(directory, 'remote.git');
  const workPath = join(directory, 'work');

  await $`git init --quiet --bare ${remotePath}`;
  await $`git init --quiet -b main ${workPath}`;
  await $`git -C ${workPath} remote add origin ${remotePath}`;

  return { workPath };
}

test("it reads the commit at the tip of origin's main", async () => {
  const ctx = await setupTest();

  await $`git -C ${ctx.workPath} -c user.name=Kestrel -c user.email=kestrel@example.com -c commit.gpgsign=false commit --quiet --allow-empty -m 'add the label set'`;
  await $`git -C ${ctx.workPath} push --quiet origin main`;

  const commit = await $`git -C ${ctx.workPath} rev-parse HEAD`.text();
  const tip = await readMainTip(ctx.workPath);

  expect(tip).toBe(commit.trim());
});

test('it rejects an origin without a main branch', async () => {
  const ctx = await setupTest();

  expect(readMainTip(ctx.workPath)).rejects.toThrowWithMessage(
    Error,
    `origin of ${ctx.workPath} has no main branch`,
  );
});
