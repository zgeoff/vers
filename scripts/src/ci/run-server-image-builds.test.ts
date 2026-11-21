import { expect, mock, onTestFinished, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateEnv } from '@zgeoff/testing';
import { createStubBin } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { runServerImageBuilds } from './run-server-image-builds';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'server-image-builds-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  return { directory };
}

test('it builds the web image, then one image for each service with a fly config', async () => {
  const ctx = await setupTest();

  const rootPath = join(ctx.directory, 'repo');
  const argsPath = join(ctx.directory, 'args');

  await mkdir(join(rootPath, 'services/kiln'), { recursive: true });
  await mkdir(join(rootPath, 'services/glaze'), { recursive: true });
  await mkdir(join(rootPath, 'services/notes'), { recursive: true });
  await writeFile(join(rootPath, 'services/kiln/fly.toml'), "app = 'kiln'\n");
  await writeFile(join(rootPath, 'services/glaze/fly.toml'), "app = 'glaze'\n");

  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'docker', {
    script: `#!/bin/sh\nprintf '%s|%s\\n' "$PWD" "$*" >> '${argsPath}'`,
  });

  await runServerImageBuilds({ rootPath, writeLine: () => {} });

  const args = await readFile(argsPath, 'utf8');

  expect(args).toBe(
    [
      `${rootPath}|build --file apps/web/Dockerfile .`,
      `${rootPath}|build --file services/Dockerfile --build-arg SERVICE=glaze .`,
      `${rootPath}|build --file services/Dockerfile --build-arg SERVICE=kiln .`,
      '',
    ].join('\n'),
  );
});

test('it folds each image build into its own log group', async () => {
  const ctx = await setupTest();

  const writeLine = mock((_line: string) => {});

  await mkdir(join(ctx.directory, 'services/kiln'), { recursive: true });
  await writeFile(join(ctx.directory, 'services/kiln/fly.toml'), "app = 'kiln'\n");

  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);
  createStubBin(stubDirectory, 'docker', { script: '#!/bin/sh\n:' });

  await runServerImageBuilds({ rootPath: ctx.directory, writeLine });

  expect(writeLine.mock.calls).toStrictEqual([
    ['::group::apps/web'],
    ['::endgroup::'],
    ['::group::services/kiln'],
    ['::endgroup::'],
  ]);
});

test('it rejects an image build that fails', async () => {
  const ctx = await setupTest();

  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'docker', {
    script: "#!/bin/sh\necho 'failed to solve' >&2\nexit 1",
  });

  expect(runServerImageBuilds({ rootPath: ctx.directory, writeLine: () => {} })).rejects.toThrow();
});
