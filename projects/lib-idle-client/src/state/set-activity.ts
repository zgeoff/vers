import type { ActivityAppState } from '@vers/idle-core';
import { useActivityStore } from './use-activity-store';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function setActivity(activity?: ActivityAppState) {
  // oxlint-disable-next-line typescript/no-confusing-void-expression -- baseline(#236)
  return useActivityStore.setState(() => ({ activity: activity ?? null }));
}
