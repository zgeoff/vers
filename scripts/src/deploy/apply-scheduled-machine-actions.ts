import { runFlyctl } from '../utils/run-flyctl';
import { withRetry } from '../utils/with-retry';
import type { ScheduledMachineAction } from './types';

const UPDATE_ATTEMPTS = 5;
const UPDATE_RETRY_DELAY_MS = 5000;

/**
 * Runs the planned create/update-image actions against Fly. An update can
 * collide with a scheduled machine mid-run — it's stopped outside its
 * schedule window — so it retries a few times before the error surfaces.
 */
export async function applyScheduledMachineActions(
  app: string,
  sha: string,
  actions: ReadonlyArray<ScheduledMachineAction>,
): Promise<void> {
  for (const action of actions) {
    await (action.kind === 'create' ? runCreate(app, sha, action) : runUpdateImage(app, action));
  }
}

async function runCreate(
  app: string,
  sha: string,
  action: Extract<ScheduledMachineAction, { kind: 'create' }>,
): Promise<void> {
  const args = [
    'machine',
    'run',
    action.image,
    ...action.machine.command,
    '--schedule',
    action.machine.schedule,
    '--name',
    action.machine.name,
    '-a',
    app,
    '--detach',
    '--env',
    `GIT_SHA=${sha}`,
  ];

  if (action.machine.region !== undefined) {
    args.push('--region', action.machine.region);
  }

  await runFlyctl(args);
}

async function runUpdateImage(
  app: string,
  action: Extract<ScheduledMachineAction, { kind: 'update-image' }>,
): Promise<void> {
  await withRetry(
    () =>
      runFlyctl([
        'machine',
        'update',
        action.machineID,
        '-a',
        app,
        '--image',
        action.image,
        '--yes',
      ]),
    { attempts: UPDATE_ATTEMPTS, delayMS: UPDATE_RETRY_DELAY_MS },
  );
}
