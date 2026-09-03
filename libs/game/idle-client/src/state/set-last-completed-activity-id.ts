import { useIdleStore } from './use-idle-store';

export function setLastCompletedActivityID(activityID: string) {
  useIdleStore.setState(() => ({ lastCompletedActivityID: activityID }));
}
