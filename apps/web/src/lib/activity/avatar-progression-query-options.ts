import { orpc } from '../rpc/orpc';

/**
 * An avatar's settled xp/level plus its pending terminal-but-unsettled xp deltas, or `null` when
 * the avatar doesn't exist or isn't owned by the caller.
 */
export function avatarProgressionQueryOptions(avatarID: string) {
  return orpc.activity.getAvatarProgression.queryOptions({ input: { avatarID } });
}
