import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createStubCommand } from '../test-utils/create-stub-command';
import { applyBuild } from './apply-build';

test('it retries a build whose push goes silent and returns the pushed image ref', async () => {
  const flyctlPath = await createStubCommand(
    'flyctl',
    [
      'calls="$(dirname "$0")/calls"',
      'echo call >> "$calls"',
      'echo "#19 pushing layer sha256:5e1f0c2a"',
      'if [ "$(wc -l < "$calls")" -eq 1 ]; then exec sleep 30; fi',
      'echo "#19 DONE 1.2s"',
    ].join('\n'),
  );

  const imageRef = await applyBuild(
    {
      app: 'vers-service-ledger',
      configDir: 'services/ledger',
      dockerfile: 'services/Dockerfile',
      exposure: 'flycast',
      trigger: { kind: 'turbo-affected', pkg: '@vers/service-ledger' },
    },
    'a1b2c3d',
    { attempts: 2, stallAfterSeconds: 0.2, stallGraceSeconds: 0.5 },
  );

  const calls = await readFile(join(dirname(flyctlPath), 'calls'), 'utf8');

  expect({ calls, imageRef }).toStrictEqual({
    calls: 'call\ncall\n',
    imageRef: 'registry.fly.io/vers-service-ledger:deployment-a1b2c3d',
  });
});

test('it fails a build that goes silent on every attempt', async () => {
  await createStubCommand('flyctl', 'echo "#19 pushing layer sha256:5e1f0c2a"\nexec sleep 30');

  expect(
    applyBuild(
      {
        app: 'vers-service-ledger',
        configDir: 'services/ledger',
        dockerfile: 'services/Dockerfile',
        exposure: 'flycast',
        trigger: { kind: 'turbo-affected', pkg: '@vers/service-ledger' },
      },
      'a1b2c3d',
      { attempts: 2, stallAfterSeconds: 0.2, stallGraceSeconds: 0.5 },
    ),
  ).rejects.toThrowWithMessage(
    Error,
    'the build of vers-service-ledger stalled on each of its 2 attempts',
  );
});

test('it fails a build that flyctl rejects without a retry', async () => {
  const flyctlPath = await createStubCommand(
    'flyctl',
    'echo call >> "$(dirname "$0")/calls"\necho "Error: failed to solve: exit code: 1" >&2\nexit 1',
  );

  const build = applyBuild(
    {
      app: 'vers-service-ledger',
      configDir: 'services/ledger',
      dockerfile: 'services/Dockerfile',
      exposure: 'flycast',
      trigger: { kind: 'turbo-affected', pkg: '@vers/service-ledger' },
    },
    'a1b2c3d',
    { attempts: 2, stallAfterSeconds: 5, stallGraceSeconds: 0.5 },
  );

  expect(build).rejects.toMatchObject({ exitCode: 1, stalledAfterMs: null });

  const calls = await readFile(join(dirname(flyctlPath), 'calls'), 'utf8');

  expect(calls).toBe('call\n');
});
