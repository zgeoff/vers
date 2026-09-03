import pRetry from 'p-retry';
import { runFlyctl } from '../utils/run-flyctl';
import { readAppState } from './read-app-state';
import type { AppState } from './types';

const WAKE_RETRIES = 19;
const WAKE_DELAY_MS = 3000;

export async function checkParkedApp(app: string, state: AppState): Promise<ReadonlyArray<string>> {
  if (state.machines.some((machine) => machine.state === 'started')) {
    return [];
  }

  const [machine] = state.machines;

  if (machine === undefined) {
    return [];
  }

  try {
    await runFlyctl(['machine', 'start', machine.id, '--app', app]);

    await pRetry(
      async () => {
        const current = await readAppState(app);

        const woken = current.machines.find((candidate) => candidate.id === machine.id);

        if (woken === undefined) {
          throw new Error(`machine ${machine.id} disappeared while waking`);
        }

        if (woken.state !== 'started') {
          throw new Error(`machine ${machine.id} is ${woken.state}`);
        }

        const failing = (woken.checks ?? []).find((check) => check.status !== 'passing');

        if (failing !== undefined) {
          throw new Error(
            `machine ${machine.id} health check ${failing.name} is ${failing.status}`,
          );
        }
      },
      { factor: 1, minTimeout: WAKE_DELAY_MS, retries: WAKE_RETRIES },
    );

    return [];
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return [`wake failed: ${reason}`];
  }
}
