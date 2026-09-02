import { orpc } from '../rpc/orpc';

const IDLE_REFETCH_INTERVAL_MS = 10_000;
const SETTLING_REFETCH_INTERVAL_MS = 2000;

interface ProgressionRefetchQuery {
  readonly state: {
    readonly data?: { readonly pending: ReadonlyArray<unknown> } | null | undefined;
  };
}

export function buildAvatarProgressionQueryOptions(avatarID: string) {
  return {
    ...orpc.activity.getAvatarProgression.queryOptions({ input: { avatarID } }),
    refetchInterval: (query: ProgressionRefetchQuery) =>
      (query.state.data?.pending.length ?? 0) > 0
        ? SETTLING_REFETCH_INTERVAL_MS
        : IDLE_REFETCH_INTERVAL_MS,
  };
}
