import type { ActivityAppState } from '@vers/idle-core';
import { useActivityStore } from './use-activity-store';

export function setActivity(activity?: ActivityAppState) {
  return useActivityStore.setState(() => ({ activity: activity ?? null }));
}
