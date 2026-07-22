import { expect, test } from 'bun:test';
import { createMockSimVersionRow } from '@vers/sim-registry/test-utils';
import { buildProviderAppName } from './build-provider-app-name';
import { planSimVersionActions } from './plan-sim-version-actions';
import type { FleetImage } from './types';

const ENGINE_HASH = 'a1b2c3d4e5f6'.padEnd(64, '0');
const PROVIDER_APP = 'vers-replay-a1b2c3d4e5f6';
const REGION = 'syd';

const fleetImage: FleetImage = {
  digest: 'sha256:current',
  repository: 'registry.fly.io/vers-service-replay',
  tag: 'deployment-current',
};

test('it provisions everything for a fresh engine hash', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage,
    providerAppExists: false,
    providerMachineExists: false,
    providerMachineID: null,
    providerMachineImageDigest: null,
    providerMachineRegion: null,
    region: REGION,
    registryRow: undefined,
  });

  expect(actions).toStrictEqual([
    { app: PROVIDER_APP, kind: 'create-provider-app' },
    { app: PROVIDER_APP, kind: 'allocate-flycast-ip' },
    {
      app: PROVIDER_APP,
      image: `${fleetImage.repository}:${fleetImage.tag}`,
      kind: 'run-provider-machine',
      region: REGION,
    },
    {
      input: {
        bunVersion: '1.3.10',
        engineHash: ENGINE_HASH,
        imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
        providerURL: `http://${PROVIDER_APP}.flycast`,
      },
      kind: 'upsert-registry-row',
    },
  ]);
});

test('it carries the declared region on a fresh provision', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage,
    providerAppExists: false,
    providerMachineExists: false,
    providerMachineID: null,
    providerMachineImageDigest: null,
    providerMachineRegion: null,
    region: REGION,
    registryRow: undefined,
  });

  const runAction = actions.find((action) => action.kind === 'run-provider-machine');

  expect(runAction?.kind === 'run-provider-machine' && runAction.region).toBe(REGION);
});

test('it takes no action when the registry row is current and the machine runs the fleet digest', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage,
    providerAppExists: true,
    providerMachineExists: true,
    providerMachineID: 'machine-1',
    providerMachineImageDigest: fleetImage.digest,
    providerMachineRegion: REGION,
    region: REGION,
    registryRow: createMockSimVersionRow({
      imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
    }),
  });

  expect(actions).toBeEmpty();
});

test('it recreates the provider app and refreshes the row when the app is missing', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage,
    providerAppExists: false,
    providerMachineExists: false,
    providerMachineID: null,
    providerMachineImageDigest: null,
    providerMachineRegion: null,
    region: REGION,
    registryRow: createMockSimVersionRow({
      imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
    }),
  });

  expect(actions).toStrictEqual([
    { app: PROVIDER_APP, kind: 'create-provider-app' },
    { app: PROVIDER_APP, kind: 'allocate-flycast-ip' },
    {
      app: PROVIDER_APP,
      image: `${fleetImage.repository}:${fleetImage.tag}`,
      kind: 'run-provider-machine',
      region: REGION,
    },
    {
      input: {
        bunVersion: '1.3.10',
        engineHash: ENGINE_HASH,
        imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
        providerURL: `http://${PROVIDER_APP}.flycast`,
      },
      kind: 'upsert-registry-row',
    },
  ]);
});

test('it only refreshes the registry row when the fleet digest has drifted from the stored one', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage,
    providerAppExists: true,
    providerMachineExists: true,
    providerMachineID: 'machine-1',
    providerMachineImageDigest: fleetImage.digest,
    providerMachineRegion: REGION,
    region: REGION,
    registryRow: createMockSimVersionRow({
      imageRef: `${fleetImage.repository}@sha256:stale`,
    }),
  });

  expect(actions).toStrictEqual([
    {
      input: {
        bunVersion: '1.3.10',
        engineHash: ENGINE_HASH,
        imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
        providerURL: `http://${PROVIDER_APP}.flycast`,
      },
      kind: 'upsert-registry-row',
    },
  ]);
});

test('it relaunches only the machine when the app survives but its machine is gone', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage,
    providerAppExists: true,
    providerMachineExists: false,
    providerMachineID: null,
    providerMachineImageDigest: null,
    providerMachineRegion: null,
    region: REGION,
    registryRow: createMockSimVersionRow({
      imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
    }),
  });

  expect(actions).toStrictEqual([
    {
      app: PROVIDER_APP,
      image: `${fleetImage.repository}:${fleetImage.tag}`,
      kind: 'run-provider-machine',
      region: REGION,
    },
    {
      input: {
        bunVersion: '1.3.10',
        engineHash: ENGINE_HASH,
        imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
        providerURL: `http://${PROVIDER_APP}.flycast`,
      },
      kind: 'upsert-registry-row',
    },
  ]);
});

test('it replaces a running machine whose image digest has drifted from the fleet', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage,
    providerAppExists: true,
    providerMachineExists: true,
    providerMachineID: 'machine-1',
    providerMachineImageDigest: 'sha256:stale',
    providerMachineRegion: REGION,
    region: REGION,
    registryRow: createMockSimVersionRow({
      imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
    }),
  });

  expect(actions).toStrictEqual([
    {
      app: PROVIDER_APP,
      image: `${fleetImage.repository}:${fleetImage.tag}`,
      kind: 'replace-provider-machine',
      machineID: 'machine-1',
      region: REGION,
    },
    {
      input: {
        bunVersion: '1.3.10',
        engineHash: ENGINE_HASH,
        imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
        providerURL: `http://${PROVIDER_APP}.flycast`,
      },
      kind: 'upsert-registry-row',
    },
  ]);
});

test('it replaces a running machine sitting outside the declared region even when its image is current', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage,
    providerAppExists: true,
    providerMachineExists: true,
    providerMachineID: 'machine-1',
    providerMachineImageDigest: fleetImage.digest,
    providerMachineRegion: 'iad',
    region: REGION,
    registryRow: createMockSimVersionRow({
      imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
    }),
  });

  expect(actions).toStrictEqual([
    {
      app: PROVIDER_APP,
      image: `${fleetImage.repository}:${fleetImage.tag}`,
      kind: 'replace-provider-machine',
      machineID: 'machine-1',
      region: REGION,
    },
    {
      input: {
        bunVersion: '1.3.10',
        engineHash: ENGINE_HASH,
        imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
        providerURL: `http://${PROVIDER_APP}.flycast`,
      },
      kind: 'upsert-registry-row',
    },
  ]);
});

test('it refreshes only the row when the app and machine exist but the row is missing', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage,
    providerAppExists: true,
    providerMachineExists: true,
    providerMachineID: 'machine-1',
    providerMachineImageDigest: fleetImage.digest,
    providerMachineRegion: REGION,
    region: REGION,
    registryRow: undefined,
  });

  expect(actions).toStrictEqual([
    {
      input: {
        bunVersion: '1.3.10',
        engineHash: ENGINE_HASH,
        imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
        providerURL: `http://${PROVIDER_APP}.flycast`,
      },
      kind: 'upsert-registry-row',
    },
  ]);
});

test('it launches the provider machine by tag, never by digest', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage,
    providerAppExists: false,
    providerMachineExists: false,
    providerMachineID: null,
    providerMachineImageDigest: null,
    providerMachineRegion: null,
    region: REGION,
    registryRow: undefined,
  });

  const runAction = actions.find((action) => action.kind === 'run-provider-machine');

  expect(runAction?.image).toBe(`${fleetImage.repository}:${fleetImage.tag}`);
  expect(runAction?.image).not.toInclude('sha256:');
});

test('it replaces the provider machine by tag, never by digest', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage,
    providerAppExists: true,
    providerMachineExists: true,
    providerMachineID: 'machine-1',
    providerMachineImageDigest: 'sha256:stale',
    providerMachineRegion: REGION,
    region: REGION,
    registryRow: undefined,
  });

  const replaceAction = actions.find((action) => action.kind === 'replace-provider-machine');

  expect(replaceAction?.image).toBe(`${fleetImage.repository}:${fleetImage.tag}`);
  expect(replaceAction?.image).not.toInclude('sha256:');
});

test('it derives the provider app name and flycast URL from the first 12 hex chars of the engine hash', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage,
    providerAppExists: false,
    providerMachineExists: false,
    providerMachineID: null,
    providerMachineImageDigest: null,
    providerMachineRegion: null,
    region: REGION,
    registryRow: undefined,
  });

  const createAction = actions.find((action) => action.kind === 'create-provider-app');
  const upsertAction = actions.find((action) => action.kind === 'upsert-registry-row');

  expect(buildProviderAppName(ENGINE_HASH)).toBe('vers-replay-a1b2c3d4e5f6');
  expect(createAction?.app).toBe('vers-replay-a1b2c3d4e5f6');

  expect(upsertAction?.kind === 'upsert-registry-row' && upsertAction.input.providerURL).toBe(
    'http://vers-replay-a1b2c3d4e5f6.flycast',
  );
});

test('it takes no action when the fleet has no single resolved image', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage: null,
    providerAppExists: false,
    providerMachineExists: false,
    providerMachineID: null,
    providerMachineImageDigest: null,
    providerMachineRegion: null,
    region: REGION,
    registryRow: undefined,
  });

  expect(actions).toBeEmpty();
});
