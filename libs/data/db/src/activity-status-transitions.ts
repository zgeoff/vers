import type { ActivityStatus } from './schema.generated';

export const ACTIVITY_STATUS_TRANSITIONS = {
  active: ['capped', 'parked', 'quarantined', 'rejected', 'stopped'],
  capped: ['parked', 'quarantined', 'rejected'],
  parked: ['active', 'capped', 'stopped'],
  quarantined: [],
  rejected: [],
  stopped: ['parked', 'quarantined', 'rejected'],
} as const satisfies Readonly<Record<ActivityStatus, ReadonlyArray<ActivityStatus>>>;
