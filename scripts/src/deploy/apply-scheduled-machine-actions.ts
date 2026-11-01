import pRetry from 'p-retry';
import { match } from 'ts-pattern';
import { FlyctlError } from '../utils/flyctl-error';
import { runFlyctl } from '../utils/run-flyctl';
import { SCHEDULED_MACHINE_METADATA_KEY } from './scheduled-machine-metadata-key';
import type { ScheduledMachine, ScheduledMachineAction } from './types';

interface UpdateRetry {
  readonly delayMs: number;
  readonly retries: number;
}

// an update can collide with Fly stopping the scheduled machine outside its schedule window, so
// it retries a few times before the error is raised
const UPDATE_RETRY: UpdateRetry = { delayMs: 5000, retries: 4 };

export async function applyScheduledMachineActions(
  app: string,
  sha: string,
  actions: ReadonlyArray<ScheduledMachineAction>,
  updateRetry: UpdateRetry = UPDATE_RETRY,
): Promise<void> {
  for (const action of actions) {
    await match(action)
      .with({ kind: 'create' }, (create) => runCreate(app, sha, create, create.machine.name))
      .with({ kind: 'update-image' }, (update) => runUpdateImage(app, sha, update, updateRetry))
      .with({ kind: 'destroy' }, (destroy) => runDestroy(app, destroy.machineID))
      .exhaustive();
  }
}

async function runCreate(
  app: string,
  sha: string,
  action: Exclude<ScheduledMachineAction, { kind: 'destroy' }>,
  flyName: string,
): Promise<void> {
  const args = [
    'machine',
    'run',
    action.image,
    ...action.machine.command,
    '--schedule',
    action.machine.schedule,
    '--name',
    flyName,
    '--metadata',
    `${SCHEDULED_MACHINE_METADATA_KEY}=${action.machine.name}`,
    '-a',
    app,
    '--detach',
    '--env',
    `GIT_SHA=${sha}`,
  ];

  if (action.machine.region !== undefined) {
    args.push('--region', action.machine.region);
  }

  await runFlyctl([...args, ...buildEnvArgs(action.machine)]);
}

// `fly machine run` and `fly machine update` read no `[env]` from fly.toml, so a key the binary
// needs travels on every create and every image roll
function buildEnvArgs(machine: ScheduledMachine): ReadonlyArray<string> {
  return Object.entries(machine.env ?? {}).flatMap(([name, value]) => [
    '--env',
    `${name}=${value}`,
  ]);
}

const SHORT_SHA_LENGTH = 7;

async function runUpdateImage(
  app: string,
  sha: string,
  action: Extract<ScheduledMachineAction, { kind: 'update-image' }>,
  updateRetry: UpdateRetry,
): Promise<void> {
  try {
    await pRetry(
      () =>
        runFlyctl([
          'machine',
          'update',
          action.machineID,
          '-a',
          app,
          '--image',
          action.image,
          '--env',
          `GIT_SHA=${sha}`,
          ...buildEnvArgs(action.machine),
          '--yes',
        ]),
      {
        factor: 1,
        minTimeout: updateRetry.delayMs,
        retries: updateRetry.retries,
        shouldRetry: (context) => !isHostCapacityError(context.error),
      },
    );
  } catch (error) {
    if (!isHostCapacityError(error)) {
      throw error;
    }

    console.log(
      `${app}: the host of scheduled machine ${action.machine.name} (${action.machineID}) has no room for the new image — replacing it`,
    );

    await runCreate(app, sha, action, `${action.machine.name}-${sha.slice(0, SHORT_SHA_LENGTH)}`);
    await runDestroy(app, action.machineID);
  }
}

// `fly machine update` keeps a machine on its current host, so a retry cannot clear this error and
// only a new machine, which Fly places on a host with room, takes the new image
function isHostCapacityError(error: unknown): boolean {
  return error instanceof FlyctlError && error.stderr.includes('could not reserve resource');
}

async function runDestroy(app: string, machineID: string): Promise<void> {
  await runFlyctl(['machine', 'destroy', '--force', machineID, '-a', app]);
}
