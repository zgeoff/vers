import { createDB } from '@vers/db';
import { upsertSimVersion } from '@vers/sim-registry';
import type { UpsertSimVersionInput } from '@vers/sim-registry';
import { requireEnvVar } from '../utils/require-env-var';
import { runFlyctl } from '../utils/run-flyctl';
import { applyIPPostureActions } from './apply-ip-posture-actions';
import type { SimVersionAction } from './types';

const PROVIDER_MACHINE_FLAGS = [
  '--port',
  '80:3000/tcp:http',
  '--autostart',
  '--autostop=suspend',
  '--vm-memory',
  '256',
  '--detach',
];

/**
 * Runs the planner's actions against Fly and the shared database, in order —
 * the provider app before its flycast IP, the IP before the machine that
 * needs it, and the registry row last so it never points at an app that
 * doesn't exist yet.
 */
export async function applySimVersionActions(
  actions: ReadonlyArray<SimVersionAction>,
): Promise<void> {
  for (const action of actions) {
    await applySimVersionAction(action);
  }
}

async function applySimVersionAction(action: SimVersionAction): Promise<void> {
  if (action.kind === 'create-provider-app') {
    await runFlyctl(['apps', 'create', action.app, '-o', 'vers']);

    return;
  }

  if (action.kind === 'allocate-flycast-ip') {
    await applyIPPostureActions([action]);

    return;
  }

  if (action.kind === 'run-provider-machine') {
    await runProviderMachine(action.app, action.image);

    return;
  }

  await upsertRegistryRow(action.input);
}

async function runProviderMachine(app: string, image: string): Promise<void> {
  const jwks = requireEnvVar(
    'SERVICE_AUTH_JWKS',
    'a sim-version provider machine must verify inbound s2s calls',
  );

  await runFlyctl([
    'machine',
    'run',
    image,
    '-a',
    app,
    ...PROVIDER_MACHINE_FLAGS,
    '--env',
    `SERVICE_AUTH_JWKS=${jwks}`,
  ]);
}

async function upsertRegistryRow(input: Readonly<UpsertSimVersionInput>): Promise<void> {
  const databaseURL = requireEnvVar(
    'DATABASE_URL',
    'the sim-version reconcile writes to the sim_versions registry',
  );

  const db = createDB({ databaseURL });

  await upsertSimVersion(db, input);

  await db.destroy();
}
