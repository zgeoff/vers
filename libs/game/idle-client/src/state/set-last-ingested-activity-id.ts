import { useIdleStore } from './use-idle-store';

/**
 * Records the activity whose client-minted start the worker most recently landed on the server.
 * The activity is readable through the activity service from this point on, so a consumer holding
 * a read back re-derives when this slice changes.
 */
export function setLastIngestedActivityID(activityID: string) {
  useIdleStore.setState(() => ({ lastIngestedActivityID: activityID }));
}
