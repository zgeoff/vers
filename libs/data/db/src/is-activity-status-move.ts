import { ACTIVITY_STATUS_TRANSITIONS } from './activity-status-transitions';
import type { ActivityStatus } from './schema.generated';

export function isActivityStatusMove(from: ActivityStatus, to: ActivityStatus): boolean {
  const targets: ReadonlyArray<ActivityStatus> = ACTIVITY_STATUS_TRANSITIONS[from];

  return targets.includes(to);
}
