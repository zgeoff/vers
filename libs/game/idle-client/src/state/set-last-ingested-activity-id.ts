import { useIdleStore } from './use-idle-store';

export function setLastIngestedActivityID(activityID: string) {
  useIdleStore.setState(() => ({ lastIngestedActivityID: activityID }));
}
