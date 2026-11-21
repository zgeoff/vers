import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createStubCommand } from '../test-utils/create-stub-command';
import { applyBuild } from './apply-build';

test('it retries a build whose push goes silent and returns the pushed image ref', async () => {
  const flyctlPath = createStubCommand(
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

test('it fails a build that goes silent on every attempt', () => {
  createStubCommand('flyctl', 'echo "#19 pushing layer sha256:5e1f0c2a"\nexec sleep 30');

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
  const flyctlPath = createStubCommand(
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

test('it passes a build secret to flyctl as a build secret, never as a build arg', async () => {
  const flyctlPath = createStubCommand(
    'flyctl',
    String.raw`printf "%s\n" "$@" > "$(dirname "$0")/args"`,
  );

  process.env['LEDGER_UPLOAD_TOKEN'] = 'ledger-token-value';

  try {
    await applyBuild(
      {
        app: 'vers-service-ledger',
        buildSecretsFromEnv: ['LEDGER_UPLOAD_TOKEN'],
        configDir: 'services/ledger',
        dockerfile: 'services/Dockerfile',
        exposure: 'flycast',
        trigger: { kind: 'turbo-affected', pkg: '@vers/service-ledger' },
      },
      'a1b2c3d',
      { attempts: 1, stallAfterSeconds: 5, stallGraceSeconds: 0.5 },
    );
  } finally {
    delete process.env['LEDGER_UPLOAD_TOKEN'];
  }

  const argsFile = await readFile(join(dirname(flyctlPath), 'args'), 'utf8');

  const args = argsFile.split('\n');

  expect(args).toContainEqual('LEDGER_UPLOAD_TOKEN=ledger-token-value');
  expect(args[args.indexOf('LEDGER_UPLOAD_TOKEN=ledger-token-value') - 1]).toBe('--build-secret');
});
