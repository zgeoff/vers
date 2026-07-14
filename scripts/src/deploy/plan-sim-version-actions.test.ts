import { expect, test } from 'bun:test';
import type { SimVersionRow } from '@vers/sim-registry';
import { buildProviderAppName } from './build-provider-app-name';
import { planSimVersionActions } from './plan-sim-version-actions';
import type { FleetImage } from './types';

const ENGINE_HASH = 'a1b2c3d4e5f6'.padEnd(64, '0');
const PROVIDER_APP = 'vers-replay-a1b2c3d4e5f6';

const fleetImage: FleetImage = {
  digest: 'sha256:current',
  repository: 'registry.fly.io/vers-service-replay',
  tag: 'deployment-current',
};

function buildRegistryRow(overrides: Partial<SimVersionRow> = {}): SimVersionRow {
  return {
    bunVersion: '1.3.10',
    createdAt: new Date('2026-01-01'),
    deployedAt: new Date('2026-01-01'),
    engineHash: ENGINE_HASH,
    imageRef: `${fleetImage.repository}@${fleetImage.digest}`,
    providerUrl: `http://${PROVIDER_APP}.flycast`,
    retainedUntil: new Date('2026-02-01'),
    status: 'active',
    ...overrides,
  };
}

test('it provisions everything for a fresh engine hash', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage,
    providerAppExists: false,
    providerMachineExists: false,
    registryRow: undefined,
  });

  expect(actions).toStrictEqual([
    { app: PROVIDER_APP, kind: 'create-provider-app' },
    { app: PROVIDER_APP, kind: 'allocate-flycast-ip' },
    {
      app: PROVIDER_APP,
      image: `${fleetImage.repository}:${fleetImage.tag}`,
      kind: 'run-provider-machine',
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

test('it takes no action when the registry row is current and the app already exists', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage,
    providerAppExists: true,
    providerMachineExists: true,
    registryRow: buildRegistryRow(),
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
    registryRow: buildRegistryRow(),
  });

  expect(actions).toStrictEqual([
    { app: PROVIDER_APP, kind: 'create-provider-app' },
    { app: PROVIDER_APP, kind: 'allocate-flycast-ip' },
    {
      app: PROVIDER_APP,
      image: `${fleetImage.repository}:${fleetImage.tag}`,
      kind: 'run-provider-machine',
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
    registryRow: buildRegistryRow({ imageRef: `${fleetImage.repository}@sha256:stale` }),
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
    registryRow: buildRegistryRow(),
  });

  expect(actions).toStrictEqual([
    {
      app: PROVIDER_APP,
      image: `${fleetImage.repository}:${fleetImage.tag}`,
      kind: 'run-provider-machine',
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
    registryRow: undefined,
  });

  const runAction = actions.find((action) => action.kind === 'run-provider-machine');

  expect(runAction?.image).toBe(`${fleetImage.repository}:${fleetImage.tag}`);
  expect(runAction?.image).not.toInclude('sha256:');
});

test('it derives the provider app name and flycast URL from the first 12 hex chars of the engine hash', () => {
  const actions = planSimVersionActions({
    bunVersion: '1.3.10',
    engineHash: ENGINE_HASH,
    fleetImage,
    providerAppExists: false,
    providerMachineExists: false,
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
    registryRow: undefined,
  });

  expect(actions).toBeEmpty();
});
