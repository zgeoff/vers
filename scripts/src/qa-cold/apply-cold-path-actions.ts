import { runFlyctl } from '../utils/run-flyctl';
import type { ColdPathAction } from './types';

export async function applyColdPathActions(actions: ReadonlyArray<ColdPathAction>): Promise<void> {
  for (const action of actions) {
    console.log(`${action.kind} machine ${action.machineID} (${action.app})`);

    await runFlyctl(['machine', action.kind, action.machineID, '-a', action.app]);
  }
}
