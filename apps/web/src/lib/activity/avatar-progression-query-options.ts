import { orpc } from '../rpc/orpc';

/**
 * Query options for an avatar's settled xp/level plus its pending terminal-but-unsettled xp
 * deltas, or `null` when the avatar doesn't exist or isn't owned by the caller. Refetched on a
 * modest interval: settlement lands server-side with no client signal, so polling is what lets a
 * pending delta quietly firm up into the settled row.
 */
export function avatarProgressionQueryOptions(avatarID: string) {
  return {
    ...orpc.activity.getAvatarProgression.queryOptions({ input: { avatarID } }),
    refetchInterval: 10_000,
  };
}
