import { useIdleStore } from './use-idle-store';

/**
 * Records the activity the worker most recently reported completed. Completion is terminal per
 * activity id, so a change in this slice is always a fresh completion.
 */
export function setLastCompletedActivityID(activityID: string) {
  useIdleStore.setState(() => ({ lastCompletedActivityID: activityID }));
}
