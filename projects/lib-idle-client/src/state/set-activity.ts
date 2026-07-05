import type { ActivityAppState } from '@vers/idle-core';
import { useActivityStore } from './use-activity-store';

export const setActivity = (activity?: ActivityAppState) =>
  useActivityStore.setState(() => ({ activity: activity ?? null }));
