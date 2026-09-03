import { runFlyctl } from '../utils/run-flyctl';
import type { RetentionAction } from './plan-retention-actions';

export async function applyRetentionActions(
  actions: ReadonlyArray<RetentionAction>,
): Promise<void> {
  for (const action of actions) {
    await runFlyctl(['apps', 'destroy', action.app, '--yes']);
  }
}
