import { runFlyctl } from '../utils/run-flyctl';
import type { RetentionAction } from './plan-retention-actions';

/**
 * Destroys each tombstoned version's provider app. Safe to run after the row is already pruned —
 * the planner's ordering means a destroy failure here never strands an active row with no app
 * behind it.
 */
export async function applyRetentionActions(
  actions: ReadonlyArray<RetentionAction>,
): Promise<void> {
  for (const action of actions) {
    await runFlyctl(['apps', 'destroy', action.app, '--yes']);
  }
}
