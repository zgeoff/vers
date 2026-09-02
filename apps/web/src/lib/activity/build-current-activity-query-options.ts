import { orpc } from '../rpc/orpc';

export function buildCurrentActivityQueryOptions(avatarID: string) {
  return orpc.activity.getCurrentActivity.queryOptions({ input: { avatarID } });
}
