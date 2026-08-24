import * as Sentry from '@sentry/react';
import type { QueryClient, QueryKey, QueryState } from '@tanstack/react-query';
import { RSC_QUERY_KEY_PREFIX } from './rsc-query-key-prefix';

/**
 * The channel every tab of one origin mirrors its query cache over.
 */
export const QUERY_BROADCAST_CHANNEL_NAME = 'vers-query';

/**
 * One cache change as the tabs receiving it see it. An `updated` message carries the resolved
 * state a peer adopts wholesale; a `removed` message names a query its sender dropped while
 * something still observed it.
 */
type QueryBroadcast =
  | {
      readonly queryHash: string;
      readonly queryKey: QueryKey;
      readonly state: QueryState;
      readonly type: 'updated';
    }
  | { readonly queryHash: string; readonly type: 'removed' };

/**
 * A cache event reduced to the two discriminators that decide whether it is worth sending.
 */
interface QueryCacheChange {
  readonly actionType: string | undefined;
  readonly type: string;
}

/**
 * The query fields a broadcast reads. The cache types every query it hands a subscriber with `any`
 * arguments, so the reader states the shape it needs instead.
 */
interface BroadcastableQuery {
  readonly observers: ReadonlyArray<unknown>;
  readonly queryHash: string;
  readonly queryKey: QueryKey;
  readonly state: QueryState;
}

/**
 * Mirrors one tab's query cache onto every other tab of the same origin, so a query that resolves
 * or is dropped in one tab lands in the rest. Returns the detach that closes the channel and stops
 * both directions. Callers subscribe once per browser session, since the subscription outlives
 * every query it carries.
 *
 * The same module loads on the server during SSR, where no tab exists to mirror onto: there the
 * call subscribes to nothing and hands back a detach that does nothing.
 *
 * Every message crosses a structured clone, which rejects an RSC composite component. A query
 * cached under the RSC key prefix stays out of the broadcast for that reason. A payload that fails
 * the clone anyway is reported rather than thrown: the throw would abort the cache's whole
 * notification round and strand the observers queued behind this subscriber.
 */
export function subscribeToQueryBroadcast(queryClient: QueryClient): () => void {
  if (globalThis.window === undefined || typeof BroadcastChannel === 'undefined') {
    return () => {
      // no channel was opened, so nothing detaches
    };
  }

  const channel = new BroadcastChannel(QUERY_BROADCAST_CHANNEL_NAME);

  const queryCache = queryClient.getQueryCache();

  // set while an incoming message is applied, so applying it does not echo straight back out
  let applying = false;

  const unsubscribe = queryCache.subscribe((event) => {
    if (applying) {
      return;
    }

    const change: QueryCacheChange = {
      actionType: event.type === 'updated' ? event.action.type : undefined,
      type: event.type,
    };

    const message = buildQueryBroadcast(change, event.query);

    if (message === null) {
      return;
    }

    try {
      channel.postMessage(message);
    } catch (error) {
      Sentry.captureException(error);
    }
  });

  channel.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (!isQueryBroadcast(event.data)) {
      return;
    }

    applying = true;

    try {
      applyQueryBroadcast(queryClient, event.data);
    } finally {
      applying = false;
    }
  });

  return () => {
    unsubscribe();

    channel.close();
  };
}

/**
 * The message a cache event is worth sending, or `null` for an event a peer cannot act on: a fetch
 * that has not resolved, a garbage collection the receiving tab must not copy, and every event on
 * an RSC-keyed query.
 */
function buildQueryBroadcast(
  change: QueryCacheChange,
  query: BroadcastableQuery,
): null | QueryBroadcast {
  if (query.queryKey[0] === RSC_QUERY_KEY_PREFIX) {
    return null;
  }

  if (change.type === 'updated' && change.actionType === 'success') {
    return {
      queryHash: query.queryHash,
      queryKey: query.queryKey,
      state: query.state,
      type: 'updated',
    };
  }

  if (change.type === 'removed' && query.observers.length > 0) {
    return { queryHash: query.queryHash, type: 'removed' };
  }

  return null;
}

/**
 * Whether a message carries everything the apply path reads. An `updated` message missing its key
 * or its state would otherwise build a query the receiving tab can neither read nor refetch.
 */
function isQueryBroadcast(data: unknown): data is QueryBroadcast {
  if (typeof data !== 'object' || data === null || !('type' in data) || !('queryHash' in data)) {
    return false;
  }

  if (typeof data.queryHash !== 'string') {
    return false;
  }

  if (data.type === 'removed') {
    return true;
  }

  return (
    data.type === 'updated' &&
    'queryKey' in data &&
    Array.isArray(data.queryKey) &&
    'state' in data &&
    typeof data.state === 'object' &&
    data.state !== null
  );
}

/**
 * Adopts a peer's change into this tab's cache: an updated query the tab does not hold yet is
 * built at the sender's hash, so the data is already there when the tab first mounts the query. A
 * snapshot older than what this tab already resolved is dropped, since two tabs resolving the same
 * query race and the later resolve is the one to keep.
 */
function applyQueryBroadcast(queryClient: QueryClient, message: QueryBroadcast): void {
  const queryCache = queryClient.getQueryCache();
  const query = queryCache.get(message.queryHash);

  if (message.type === 'removed') {
    if (query !== undefined) {
      queryCache.remove(query);
    }

    return;
  }

  if (query === undefined) {
    queryCache.build(
      queryClient,
      { queryHash: message.queryHash, queryKey: message.queryKey },
      message.state,
    );

    return;
  }

  if (message.state.dataUpdatedAt < query.state.dataUpdatedAt) {
    return;
  }

  query.setState(message.state);
}
