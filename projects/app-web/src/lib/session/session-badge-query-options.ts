import { getSessionBadgeFragment } from './get-session-badge-fragment';

/**
 * Query options for the session-badge fragment, shared between the index route's SSR prefetch
 * and the client slot's `useSuspenseQuery` read — one cache entry, one owner. RSC values need
 * `structuralSharing: false`: Query's default deep-equality check can't run over a Composite
 * Component source.
 */
export const sessionBadgeQueryOptions = {
  queryFn: () => getSessionBadgeFragment(),
  queryKey: ['rsc', 'session-badge'],
  structuralSharing: false,
};
