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

// the image's `CMD` starts the full-service `server` binary, which a provider machine's narrowed
// env cannot boot; this positional replaces it with the provider-mode binary
const PROVIDER_MACHINE_COMMAND = 'provider';

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
    await runProviderMachine(action.app, action.image, action.region, requireProviderJWKS());

    return;
  }

  if (action.kind === 'replace-provider-machine') {
    // resolved before the destroy, so a missing secret fails with the old machine still in place
    const jwks = requireProviderJWKS();

    await runFlyctl(['machine', 'destroy', '--force', action.machineID, '-a', action.app]);
    await runProviderMachine(action.app, action.image, action.region, jwks);

    return;
  }

  await upsertRegistryRow(action.input);
}

function requireProviderJWKS(): string {
  return requireEnvVar(
    'SERVICE_AUTH_JWKS',
    'a sim-version provider machine must verify inbound s2s calls',
  );
}

async function runProviderMachine(
  app: string,
  image: string,
  region: string,
  jwks: string,
): Promise<void> {
  await runFlyctl([
    'machine',
    'run',
    image,
    PROVIDER_MACHINE_COMMAND,
    '-a',
    app,
    '--region',
    region,
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
