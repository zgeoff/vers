import { orpc } from '../rpc/orpc';

/**
 * An avatar's current activity row, or `null` when none is active.
 */
export function currentActivityQueryOptions(avatarID: string) {
  return orpc.activity.getCurrentActivity.queryOptions({ input: { avatarID } });
}
