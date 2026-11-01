import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createStubCommand } from '../test-utils/create-stub-command';
import { applyScheduledMachineActions } from './apply-scheduled-machine-actions';

test('it replaces a scheduled machine whose host has no room for the new image', async () => {
  const flyctlPath = await createStubCommand(
    'flyctl',
    [
      'echo "$*" >> "$(dirname "$0")/calls"',
      'if [ "$2" = update ]; then',
      '  echo "Error: could not reserve resource for machine: insufficient memory available to fulfill request on the current host" >&2',
      '  exit 1',
      'fi',
    ].join('\n'),
  );

  await applyScheduledMachineActions('vers-service-ledger', '4f0c2e9a7b1d3c5e8f6a', [
    {
      image: 'registry.fly.io/vers-service-ledger:deployment-4f0c2e9a7b1d3c5e8f6a',
      kind: 'update-image',
      machine: {
        command: ['/usr/local/bin/compact'],
        env: { RETENTION_DAYS: '30' },
        name: 'ledger-compactor',
        region: 'syd',
        schedule: 'daily',
      },
      machineID: '3d8d9e1f2a7b68',
    },
  ]);

  const calls = await readFile(join(dirname(flyctlPath), 'calls'), 'utf8');

  expect(calls.trimEnd().split('\n')).toStrictEqual([
    'machine update 3d8d9e1f2a7b68 -a vers-service-ledger --image registry.fly.io/vers-service-ledger:deployment-4f0c2e9a7b1d3c5e8f6a --env GIT_SHA=4f0c2e9a7b1d3c5e8f6a --env RETENTION_DAYS=30 --yes',
    'machine run registry.fly.io/vers-service-ledger:deployment-4f0c2e9a7b1d3c5e8f6a /usr/local/bin/compact --schedule daily --name ledger-compactor-4f0c2e9 --metadata vers_scheduled_machine=ledger-compactor -a vers-service-ledger --detach --env GIT_SHA=4f0c2e9a7b1d3c5e8f6a --region syd --env RETENTION_DAYS=30',
    'machine destroy --force 3d8d9e1f2a7b68 -a vers-service-ledger',
  ]);
});

test('it keeps the old scheduled machine and fails when its replacement cannot be created', async () => {
  const flyctlPath = await createStubCommand(
    'flyctl',
    [
      'echo "$*" >> "$(dirname "$0")/calls"',
      'if [ "$2" = update ]; then',
      '  echo "Error: could not reserve resource for machine: insufficient memory available to fulfill request on the current host" >&2',
      '  exit 1',
      'fi',
      'if [ "$2" = run ]; then',
      '  echo "Error: could not launch machine: failed to launch VM: insufficient resources" >&2',
      '  exit 1',
      'fi',
    ].join('\n'),
  );

  const apply = applyScheduledMachineActions('vers-service-ledger', '4f0c2e9a7b1d3c5e8f6a', [
    {
      image: 'registry.fly.io/vers-service-ledger:deployment-4f0c2e9a7b1d3c5e8f6a',
      kind: 'update-image',
      machine: {
        command: ['/usr/local/bin/compact'],
        name: 'ledger-compactor',
        schedule: 'daily',
      },
      machineID: '3d8d9e1f2a7b68',
    },
  ]);

  expect(apply).rejects.toMatchObject({
    stderr: 'Error: could not launch machine: failed to launch VM: insufficient resources\n',
  });

  const calls = await readFile(join(dirname(flyctlPath), 'calls'), 'utf8');

  expect(calls.trimEnd().split('\n')).toStrictEqual([
    'machine update 3d8d9e1f2a7b68 -a vers-service-ledger --image registry.fly.io/vers-service-ledger:deployment-4f0c2e9a7b1d3c5e8f6a --env GIT_SHA=4f0c2e9a7b1d3c5e8f6a --yes',
    'machine run registry.fly.io/vers-service-ledger:deployment-4f0c2e9a7b1d3c5e8f6a /usr/local/bin/compact --schedule daily --name ledger-compactor-4f0c2e9 --metadata vers_scheduled_machine=ledger-compactor -a vers-service-ledger --detach --env GIT_SHA=4f0c2e9a7b1d3c5e8f6a',
  ]);
});

test('it fails an image roll that flyctl rejects for a reason other than host capacity, after its retries', async () => {
  const flyctlPath = await createStubCommand(
    'flyctl',
    [
      'echo "$*" >> "$(dirname "$0")/calls"',
      'echo "Error: failed to update machine: unauthorized" >&2',
      'exit 1',
    ].join('\n'),
  );

  const apply = applyScheduledMachineActions(
    'vers-service-ledger',
    '4f0c2e9a7b1d3c5e8f6a',
    [
      {
        image: 'registry.fly.io/vers-service-ledger:deployment-4f0c2e9a7b1d3c5e8f6a',
        kind: 'update-image',
        machine: {
          command: ['/usr/local/bin/compact'],
          name: 'ledger-compactor',
          schedule: 'daily',
        },
        machineID: '3d8d9e1f2a7b68',
      },
    ],
    { delayMs: 0, retries: 2 },
  );

  expect(apply).rejects.toMatchObject({
    stderr: 'Error: failed to update machine: unauthorized\n',
  });

  const calls = await readFile(join(dirname(flyctlPath), 'calls'), 'utf8');

  expect(calls.trimEnd().split('\n')).toStrictEqual([
    'machine update 3d8d9e1f2a7b68 -a vers-service-ledger --image registry.fly.io/vers-service-ledger:deployment-4f0c2e9a7b1d3c5e8f6a --env GIT_SHA=4f0c2e9a7b1d3c5e8f6a --yes',
    'machine update 3d8d9e1f2a7b68 -a vers-service-ledger --image registry.fly.io/vers-service-ledger:deployment-4f0c2e9a7b1d3c5e8f6a --env GIT_SHA=4f0c2e9a7b1d3c5e8f6a --yes',
    'machine update 3d8d9e1f2a7b68 -a vers-service-ledger --image registry.fly.io/vers-service-ledger:deployment-4f0c2e9a7b1d3c5e8f6a --env GIT_SHA=4f0c2e9a7b1d3c5e8f6a --yes',
  ]);
});
