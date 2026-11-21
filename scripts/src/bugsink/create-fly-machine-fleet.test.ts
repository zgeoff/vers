import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateEnv } from '@zgeoff/testing';
import { createStubBin } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { createFlyMachineFleet } from './create-fly-machine-fleet';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'fly-machine-fleet-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  return { directory };
}

test('it lists the machines of the app it names', async () => {
  const ctx = await setupTest();

  const argsPath = join(ctx.directory, 'args');
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'flyctl', {
    script: `#!/bin/sh\nprintf '%s\\n' "$*" > '${argsPath}'\necho '[{"id":"1781e2db","state":"suspended","region":"syd"}]'`,
  });

  const machines = await createFlyMachineFleet('kiln-errors').list();
  const args = await readFile(argsPath, 'utf8');

  expect(machines).toStrictEqual([{ id: '1781e2db', state: 'suspended' }]);
  expect(args).toBe('machines list --app kiln-errors --json\n');
});

test('it starts one machine of the app it names', async () => {
  const ctx = await setupTest();

  const argsPath = join(ctx.directory, 'args');
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'flyctl', {
    script: `#!/bin/sh\nprintf '%s\\n' "$*" > '${argsPath}'`,
  });

  await createFlyMachineFleet('kiln-errors').start('1781e2db');

  const args = await readFile(argsPath, 'utf8');

  expect(args).toBe('machine start 1781e2db --app kiln-errors\n');
});

test('it rejects a start that flyctl refuses', () => {
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'flyctl', {
    script: "#!/bin/sh\necho 'machine not found' >&2\nexit 1",
  });

  expect(createFlyMachineFleet('kiln-errors').start('1781e2db')).rejects.toThrowWithMessage(
    Error,
    /machine not found/u,
  );
});
