import { runFlyctl } from '../utils/run-flyctl';
import { withRetry } from '../utils/with-retry';
import { readAppState } from './read-app-state';
import type { AppState } from './types';

const WAKE_ATTEMPTS = 20;
const WAKE_DELAY_MS = 3000;

/**
 * Proves a fully parked app can still serve: starts one machine and waits
 * for it to run with every health check passing, leaving re-parking to the
 * app's auto-stop policy. A healthy parked fleet and a crash-parked one are
 * indistinguishable in machine state and check output alone — only a
 * successful wake separates them. Apps with a running machine are skipped;
 * their health is asserted from fleet state directly.
 */
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

    await withRetry(
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
      { attempts: WAKE_ATTEMPTS, delayMS: WAKE_DELAY_MS },
    );

    return [];
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return [`wake failed: ${reason}`];
  }
}
