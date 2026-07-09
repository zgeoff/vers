import type { ActivityAppState } from '@vers/idle-core';
import { useActivityStore } from './use-activity-store';

export function setActivity(activity?: ActivityAppState) {
  // oxlint-disable-next-line typescript/no-confusing-void-expression -- baseline(#236)
  return useActivityStore.setState(() => ({ activity: activity ?? null }));
}
