import { orpc } from '../rpc/orpc';

const IDLE_REFETCH_INTERVAL_MS = 10_000;

/**
 * The cadence while an entry is still waiting on the verifier — short enough that a settled total
 * lands close behind the run that earned it.
 */
const SETTLING_REFETCH_INTERVAL_MS = 2000;

/**
 * The one field the refetch cadence reads off a progression response.
 */
interface ProgressionRefetchQuery {
  readonly state: {
    readonly data?: { readonly pending: ReadonlyArray<unknown> } | null | undefined;
  };
}

/**
 * Query options for an avatar's settled xp/level plus its pending terminal-but-unsettled xp
 * deltas, or `null` when the avatar doesn't exist or isn't owned by the caller. Settlement lands
 * server-side with no client signal, so polling is what firms a pending delta up into the settled
 * row: the interval tightens while any entry is outstanding and relaxes once none is. A run in
 * flight needs no tightening of its own — its live overlay and the settled total that overlay nets
 * against advance together, so the figure on screen holds steady however far behind the read lags.
 */
export function buildAvatarProgressionQueryOptions(avatarID: string) {
  return {
    ...orpc.activity.getAvatarProgression.queryOptions({ input: { avatarID } }),
    refetchInterval: (query: ProgressionRefetchQuery) =>
      (query.state.data?.pending.length ?? 0) > 0
        ? SETTLING_REFETCH_INTERVAL_MS
        : IDLE_REFETCH_INTERVAL_MS,
  };
}
