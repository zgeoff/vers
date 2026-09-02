import pRetry from 'p-retry';
import { runFlyctl } from '../utils/run-flyctl';
import type { ScheduledMachineAction } from './types';

// an update can collide with Fly stopping the scheduled machine outside its schedule window, so
// it retries a few times before the error is raised
const UPDATE_RETRIES = 4;
const UPDATE_RETRY_DELAY_MS = 5000;

export async function applyScheduledMachineActions(
  app: string,
  sha: string,
  actions: ReadonlyArray<ScheduledMachineAction>,
): Promise<void> {
  for (const action of actions) {
    await (action.kind === 'create'
      ? runCreate(app, sha, action)
      : runUpdateImage(app, sha, action));
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
  sha: string,
  action: Extract<ScheduledMachineAction, { kind: 'update-image' }>,
): Promise<void> {
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
        '--yes',
      ]),
    { factor: 1, minTimeout: UPDATE_RETRY_DELAY_MS, retries: UPDATE_RETRIES },
  );
}
