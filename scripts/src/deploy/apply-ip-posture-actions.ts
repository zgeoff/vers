import { runFlyctl } from '../utils/run-flyctl';
import type { IPPostureAction } from './types';

/**
 * Runs the IP-posture planner's actions against Fly — the sim-version reconcile's own
 * `allocate-flycast-ip` action for its per-version provider apps runs through this same function.
 */
export async function applyIPPostureActions(
  actions: ReadonlyArray<IPPostureAction>,
): Promise<void> {
  for (const action of actions) {
    await runFlyctl(['ips', 'allocate-v6', '--private', '-a', action.app]);
  }
}
