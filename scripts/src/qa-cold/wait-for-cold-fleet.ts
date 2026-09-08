import pRetry from 'p-retry';
import { readAppState } from '../deploy/read-app-state';
import { isColdMachine } from './is-cold-machine';

const POLL_INTERVAL_MS = 3000;

export function waitForColdFleet(apps: ReadonlyArray<string>, timeoutMS: number): Promise<void> {
  return pRetry(
    async () => {
      for (const app of apps) {
        const state = await readAppState(app);

        const warm = state.machines.filter((machine) => !isColdMachine(machine));

        if (warm.length > 0) {
          const listed = warm.map((machine) => `${machine.id} ${machine.state}`).join(', ');

          throw new Error(`${app}: machine(s) ${listed} are not cold yet`);
        }
      }
    },
    {
      factor: 1,
      maxRetryTime: timeoutMS,
      minTimeout: POLL_INTERVAL_MS,
      retries: Math.ceil(timeoutMS / POLL_INTERVAL_MS),
    },
  );
}
