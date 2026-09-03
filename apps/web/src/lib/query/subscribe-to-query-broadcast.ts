import * as Sentry from '@sentry/react';
import type { QueryClient, QueryKey, QueryState } from '@tanstack/react-query';
import { RSC_QUERY_KEY_PREFIX } from './rsc-query-key-prefix';

export const QUERY_BROADCAST_CHANNEL_NAME = 'vers-query';

type QueryBroadcast =
  | {
      readonly queryHash: string;
      readonly queryKey: QueryKey;
      readonly state: QueryState;
      readonly type: 'updated';
    }
  | { readonly queryHash: string; readonly type: 'removed' };

interface QueryCacheChange {
  readonly actionType: string | undefined;
  readonly type: string;
}

interface BroadcastableQuery {
  readonly observers: ReadonlyArray<unknown>;
  readonly queryHash: string;
  readonly queryKey: QueryKey;
  readonly state: QueryState;
}

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
      // reported, never rethrown: a throw here would abort the cache's whole notification round and
      // strand the observers queued behind this subscriber
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
