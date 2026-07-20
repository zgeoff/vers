import pRetry from 'p-retry';
import { readAppState } from './read-app-state';

const WAIT_RETRIES = 9;
const WAIT_DELAY_MS = 3000;

/**
 * Blocks until the whole fleet for an app reports the given SHA in machine
 * env. `flyctl deploy` already waits for the rollout, so this is the
 * cheap post-cutover assertion that no machine was left behind on an old
 * image — it throws if the fleet never converges.
 */
export async function waitForDeployedSHA(app: string, sha: string): Promise<void> {
  await pRetry(
    async () => {
      const state = await readAppState(app);

      if (state.machines.length === 0) {
        throw new Error(`${app} has no machines after deploy`);
      }

      if (state.deployedSHA !== sha) {
        throw new Error(`${app} fleet reports SHA ${state.deployedSHA ?? 'none'}, expected ${sha}`);
      }
    },
    { factor: 1, minTimeout: WAIT_DELAY_MS, retries: WAIT_RETRIES },
  );
}
