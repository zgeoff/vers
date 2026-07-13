import type { ActivitySnapshot } from '@vers/idle-core';
import { useActivityStore } from './use-activity-store';

export function setActivity(activity?: ActivitySnapshot) {
  useActivityStore.setState(() => ({ activity: activity ?? null }));
}
