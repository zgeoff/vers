import { expect, test } from 'bun:test';
import { createMockSimVersionRow } from '@vers/sim-registry/test-utils';
import { buildProviderAppName } from './build-provider-app-name';
import { planSimVersionActions } from './plan-sim-version-actions';
import type { FleetImage } from './types';

test('it provisions everything for a fresh engine hash', () => {
  const fleetImage: FleetImage = {
    digest: 'sha256:current',
    repository: 'registry.fly.io/vers-service-replay',
    tag: 'deployment-current',
  };

  const actions = planSimVersionActions({
    bunVersion: '1.4.3',
    engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
    fleetImage,
    maxContentVersion: '2',
    providerAppExists: false,
    providerMachineExists: false,
    providerMachineID: null,
    providerMachineImageDigest: null,
    providerMachineRegion: null,
    region: 'syd',
    registryRow: undefined,
    retentionDays: 3,
  });

  expect(actions).toStrictEqual([
    { app: 'vers-replay-a1b2c3d4e5f6', kind: 'create-provider-app' },
    { app: 'vers-replay-a1b2c3d4e5f6', kind: 'allocate-flycast-ip' },
    {
      app: 'vers-replay-a1b2c3d4e5f6',
      image: `${fleetImage.repository}:${fleetImage.tag}`,
      kind: 'run-provider-machine',
      region: 'syd',
    },
    {
      input: {
        bunVersion: '1.4.3',
        engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
        imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
        maxContentVersion: '2',
        providerURL: 'http://vers-replay-a1b2c3d4e5f6.flycast',
        retentionDays: 3,
      },
      kind: 'upsert-registry-row',
    },
  ]);
});

test('it carries the declared region on a fresh provision', () => {
  const fleetImage: FleetImage = {
    digest: 'sha256:current',
    repository: 'registry.fly.io/vers-service-replay',
    tag: 'deployment-current',
  };

  const actions = planSimVersionActions({
    bunVersion: '1.4.3',
    engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
    fleetImage,
    maxContentVersion: '2',
    providerAppExists: false,
    providerMachineExists: false,
    providerMachineID: null,
    providerMachineImageDigest: null,
    providerMachineRegion: null,
    region: 'syd',
    registryRow: undefined,
    retentionDays: 3,
  });

  const runAction = actions.find((action) => action.kind === 'run-provider-machine');

  expect(runAction?.kind === 'run-provider-machine' && runAction.region).toBe('syd');
});

test('it takes no action when the registry row is current and the machine runs the fleet digest', () => {
  const fleetImage: FleetImage = {
    digest: 'sha256:current',
    repository: 'registry.fly.io/vers-service-replay',
    tag: 'deployment-current',
  };

  const actions = planSimVersionActions({
    bunVersion: '1.4.3',
    engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
    fleetImage,
    maxContentVersion: '2',
    providerAppExists: true,
    providerMachineExists: true,
    providerMachineID: 'machine-1',
    providerMachineImageDigest: fleetImage.digest,
    providerMachineRegion: 'syd',
    region: 'syd',
    registryRow: createMockSimVersionRow({
      imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
      maxContentVersion: '2',
    }),
    retentionDays: 3,
  });

  expect(actions).toBeEmpty();
});

test('it recreates the provider app and refreshes the row when the app is missing', () => {
  const fleetImage: FleetImage = {
    digest: 'sha256:current',
    repository: 'registry.fly.io/vers-service-replay',
    tag: 'deployment-current',
  };

  const actions = planSimVersionActions({
    bunVersion: '1.4.3',
    engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
    fleetImage,
    maxContentVersion: '2',
    providerAppExists: false,
    providerMachineExists: false,
    providerMachineID: null,
    providerMachineImageDigest: null,
    providerMachineRegion: null,
    region: 'syd',
    registryRow: createMockSimVersionRow({
      imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
      maxContentVersion: '2',
    }),
    retentionDays: 3,
  });

  expect(actions).toStrictEqual([
    { app: 'vers-replay-a1b2c3d4e5f6', kind: 'create-provider-app' },
    { app: 'vers-replay-a1b2c3d4e5f6', kind: 'allocate-flycast-ip' },
    {
      app: 'vers-replay-a1b2c3d4e5f6',
      image: `${fleetImage.repository}:${fleetImage.tag}`,
      kind: 'run-provider-machine',
      region: 'syd',
    },
    {
      input: {
        bunVersion: '1.4.3',
        engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
        imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
        maxContentVersion: '2',
        providerURL: 'http://vers-replay-a1b2c3d4e5f6.flycast',
        retentionDays: 3,
      },
      kind: 'upsert-registry-row',
    },
  ]);
});

test('it only refreshes the registry row when the fleet digest has drifted from the stored one', () => {
  const fleetImage: FleetImage = {
    digest: 'sha256:current',
    repository: 'registry.fly.io/vers-service-replay',
    tag: 'deployment-current',
  };

  const actions = planSimVersionActions({
    bunVersion: '1.4.3',
    engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
    fleetImage,
    maxContentVersion: '2',
    providerAppExists: true,
    providerMachineExists: true,
    providerMachineID: 'machine-1',
    providerMachineImageDigest: fleetImage.digest,
    providerMachineRegion: 'syd',
    region: 'syd',
    registryRow: createMockSimVersionRow({
      imageRef: `${fleetImage.repository}@sha256:stale`,
      maxContentVersion: '2',
    }),
    retentionDays: 3,
  });

  expect(actions).toStrictEqual([
    {
      input: {
        bunVersion: '1.4.3',
        engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
        imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
        maxContentVersion: '2',
        providerURL: 'http://vers-replay-a1b2c3d4e5f6.flycast',
        retentionDays: 3,
      },
      kind: 'upsert-registry-row',
    },
  ]);
});

test('it only refreshes the registry row when the bundled max content version has drifted from the stored one', () => {
  const fleetImage: FleetImage = {
    digest: 'sha256:current',
    repository: 'registry.fly.io/vers-service-replay',
    tag: 'deployment-current',
  };

  const actions = planSimVersionActions({
    bunVersion: '1.4.3',
    engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
    fleetImage,
    maxContentVersion: '2',
    providerAppExists: true,
    providerMachineExists: true,
    providerMachineID: 'machine-1',
    providerMachineImageDigest: fleetImage.digest,
    providerMachineRegion: 'syd',
    region: 'syd',
    registryRow: createMockSimVersionRow({
      imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
      maxContentVersion: '1',
    }),
    retentionDays: 3,
  });

  expect(actions).toStrictEqual([
    {
      input: {
        bunVersion: '1.4.3',
        engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
        imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
        maxContentVersion: '2',
        providerURL: 'http://vers-replay-a1b2c3d4e5f6.flycast',
        retentionDays: 3,
      },
      kind: 'upsert-registry-row',
    },
  ]);
});

test('it relaunches only the machine when the app survives but its machine is gone', () => {
  const fleetImage: FleetImage = {
    digest: 'sha256:current',
    repository: 'registry.fly.io/vers-service-replay',
    tag: 'deployment-current',
  };

  const actions = planSimVersionActions({
    bunVersion: '1.4.3',
    engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
    fleetImage,
    maxContentVersion: '2',
    providerAppExists: true,
    providerMachineExists: false,
    providerMachineID: null,
    providerMachineImageDigest: null,
    providerMachineRegion: null,
    region: 'syd',
    registryRow: createMockSimVersionRow({
      imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
      maxContentVersion: '2',
    }),
    retentionDays: 3,
  });

  expect(actions).toStrictEqual([
    {
      app: 'vers-replay-a1b2c3d4e5f6',
      image: `${fleetImage.repository}:${fleetImage.tag}`,
      kind: 'run-provider-machine',
      region: 'syd',
    },
    {
      input: {
        bunVersion: '1.4.3',
        engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
        imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
        maxContentVersion: '2',
        providerURL: 'http://vers-replay-a1b2c3d4e5f6.flycast',
        retentionDays: 3,
      },
      kind: 'upsert-registry-row',
    },
  ]);
});

test('it replaces a running machine whose image digest has drifted from the fleet', () => {
  const fleetImage: FleetImage = {
    digest: 'sha256:current',
    repository: 'registry.fly.io/vers-service-replay',
    tag: 'deployment-current',
  };

  const actions = planSimVersionActions({
    bunVersion: '1.4.3',
    engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
    fleetImage,
    maxContentVersion: '2',
    providerAppExists: true,
    providerMachineExists: true,
    providerMachineID: 'machine-1',
    providerMachineImageDigest: 'sha256:stale',
    providerMachineRegion: 'syd',
    region: 'syd',
    registryRow: createMockSimVersionRow({
      imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
      maxContentVersion: '2',
    }),
    retentionDays: 3,
  });

  expect(actions).toStrictEqual([
    {
      app: 'vers-replay-a1b2c3d4e5f6',
      image: `${fleetImage.repository}:${fleetImage.tag}`,
      kind: 'replace-provider-machine',
      machineID: 'machine-1',
      region: 'syd',
    },
    {
      input: {
        bunVersion: '1.4.3',
        engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
        imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
        maxContentVersion: '2',
        providerURL: 'http://vers-replay-a1b2c3d4e5f6.flycast',
        retentionDays: 3,
      },
      kind: 'upsert-registry-row',
    },
  ]);
});

test('it replaces a running machine sitting outside the declared region even when its image is current', () => {
  const fleetImage: FleetImage = {
    digest: 'sha256:current',
    repository: 'registry.fly.io/vers-service-replay',
    tag: 'deployment-current',
  };

  const actions = planSimVersionActions({
    bunVersion: '1.4.3',
    engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
    fleetImage,
    maxContentVersion: '2',
    providerAppExists: true,
    providerMachineExists: true,
    providerMachineID: 'machine-1',
    providerMachineImageDigest: fleetImage.digest,
    providerMachineRegion: 'iad',
    region: 'syd',
    registryRow: createMockSimVersionRow({
      imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
      maxContentVersion: '2',
    }),
    retentionDays: 3,
  });

  expect(actions).toStrictEqual([
    {
      app: 'vers-replay-a1b2c3d4e5f6',
      image: `${fleetImage.repository}:${fleetImage.tag}`,
      kind: 'replace-provider-machine',
      machineID: 'machine-1',
      region: 'syd',
    },
    {
      input: {
        bunVersion: '1.4.3',
        engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
        imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
        maxContentVersion: '2',
        providerURL: 'http://vers-replay-a1b2c3d4e5f6.flycast',
        retentionDays: 3,
      },
      kind: 'upsert-registry-row',
    },
  ]);
});

test('it refreshes only the row when the app and machine exist but the row is missing', () => {
  const fleetImage: FleetImage = {
    digest: 'sha256:current',
    repository: 'registry.fly.io/vers-service-replay',
    tag: 'deployment-current',
  };

  const actions = planSimVersionActions({
    bunVersion: '1.4.3',
    engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
    fleetImage,
    maxContentVersion: '2',
    providerAppExists: true,
    providerMachineExists: true,
    providerMachineID: 'machine-1',
    providerMachineImageDigest: fleetImage.digest,
    providerMachineRegion: 'syd',
    region: 'syd',
    registryRow: undefined,
    retentionDays: 3,
  });

  expect(actions).toStrictEqual([
    {
      input: {
        bunVersion: '1.4.3',
        engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
        imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
        maxContentVersion: '2',
        providerURL: 'http://vers-replay-a1b2c3d4e5f6.flycast',
        retentionDays: 3,
      },
      kind: 'upsert-registry-row',
    },
  ]);
});

test('it launches the provider machine by tag, never by digest', () => {
  const fleetImage: FleetImage = {
    digest: 'sha256:current',
    repository: 'registry.fly.io/vers-service-replay',
    tag: 'deployment-current',
  };

  const actions = planSimVersionActions({
    bunVersion: '1.4.3',
    engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
    fleetImage,
    maxContentVersion: '2',
    providerAppExists: false,
    providerMachineExists: false,
    providerMachineID: null,
    providerMachineImageDigest: null,
    providerMachineRegion: null,
    region: 'syd',
    registryRow: undefined,
    retentionDays: 3,
  });

  const runAction = actions.find((action) => action.kind === 'run-provider-machine');

  expect(runAction?.image).toBe(`${fleetImage.repository}:${fleetImage.tag}`);
  expect(runAction?.image).not.toInclude('sha256:');
});

test('it replaces the provider machine by tag, never by digest', () => {
  const fleetImage: FleetImage = {
    digest: 'sha256:current',
    repository: 'registry.fly.io/vers-service-replay',
    tag: 'deployment-current',
  };

  const actions = planSimVersionActions({
    bunVersion: '1.4.3',
    engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
    fleetImage,
    maxContentVersion: '2',
    providerAppExists: true,
    providerMachineExists: true,
    providerMachineID: 'machine-1',
    providerMachineImageDigest: 'sha256:stale',
    providerMachineRegion: 'syd',
    region: 'syd',
    registryRow: undefined,
    retentionDays: 3,
  });

  const replaceAction = actions.find((action) => action.kind === 'replace-provider-machine');

  expect(replaceAction?.image).toBe(`${fleetImage.repository}:${fleetImage.tag}`);
  expect(replaceAction?.image).not.toInclude('sha256:');
});

test('it derives the provider app name and flycast URL from the first 12 hex chars of the engine hash', () => {
  const fleetImage: FleetImage = {
    digest: 'sha256:current',
    repository: 'registry.fly.io/vers-service-replay',
    tag: 'deployment-current',
  };

  const actions = planSimVersionActions({
    bunVersion: '1.4.3',
    engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
    fleetImage,
    maxContentVersion: '2',
    providerAppExists: false,
    providerMachineExists: false,
    providerMachineID: null,
    providerMachineImageDigest: null,
    providerMachineRegion: null,
    region: 'syd',
    registryRow: undefined,
    retentionDays: 3,
  });

  const createAction = actions.find((action) => action.kind === 'create-provider-app');
  const upsertAction = actions.find((action) => action.kind === 'upsert-registry-row');

  expect(buildProviderAppName('a1b2c3d4e5f6'.padEnd(64, '0'))).toBe('vers-replay-a1b2c3d4e5f6');
  expect(createAction?.app).toBe('vers-replay-a1b2c3d4e5f6');

  expect(upsertAction?.kind === 'upsert-registry-row' && upsertAction.input.providerURL).toBe(
    'http://vers-replay-a1b2c3d4e5f6.flycast',
  );
});

test('it takes no action when the fleet has no single resolved image', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.4.3',
    engineHash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
    fleetImage: null,
    maxContentVersion: '2',
    providerAppExists: false,
    providerMachineExists: false,
    providerMachineID: null,
    providerMachineImageDigest: null,
    providerMachineRegion: null,
    region: 'syd',
    registryRow: undefined,
    retentionDays: 3,
  });

  expect(actions).toBeEmpty();
});
