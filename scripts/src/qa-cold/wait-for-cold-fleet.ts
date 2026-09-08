import pRetry from 'p-retry';
import { readAppState } from '../deploy/read-app-state';
import { isColdMachine } from './is-cold-machine';

const POLL_INTERVAL_MS = 3000;

export async function waitForColdFleet(
  apps: ReadonlyArray<string>,
  timeoutMS: number,
): Promise<void> {
  const deadline = AbortSignal.timeout(timeoutMS);
  let lastFailure = 'no state read completed';

  try {
    await pRetry(
      async () => {
        for (const app of apps) {
          const state = await readAppState(app, { cancelSignal: deadline });

          const warm = state.machines.filter((machine) => !isColdMachine(machine));

          if (warm.length > 0) {
            const listed = warm.map((machine) => `${machine.id} ${machine.state}`).join(', ');

            throw new Error(`${app}: machine(s) ${listed} are not cold yet`);
          }
        }
      },
      {
        factor: 1,
        minTimeout: POLL_INTERVAL_MS,
        onFailedAttempt: (context) => {
          if (!deadline.aborted) {
            lastFailure = context.error.message;
          }
        },
        retries: Number.POSITIVE_INFINITY,
        signal: deadline,
      },
    );
  } catch (error) {
    if (!deadline.aborted) {
      throw error;
    }

    throw new Error(`the fleet did not go cold within ${timeoutMS} ms (${lastFailure})`, {
      cause: error,
    });
  }
}
