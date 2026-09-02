import { runFlyctl } from '../utils/run-flyctl';
import type { IPPostureAction } from './types';

export async function applyIPPostureActions(
  actions: ReadonlyArray<IPPostureAction>,
): Promise<void> {
  for (const action of actions) {
    await runFlyctl(['ips', 'allocate-v6', '--private', '-a', action.app]);
  }
}
