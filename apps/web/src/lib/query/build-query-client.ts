import { ORPCError } from '@orpc/client';
import * as Sentry from '@sentry/react';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isNotFound, isRedirect } from '@tanstack/react-router';
import { LAST_KNOWN_QUERY_KEY_PREFIX } from '../offline/last-known-query-key-prefix';
import { NetworkFailureError } from '../offline/network-failure-error';

export function buildQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetryError },
    },
    mutationCache: new MutationCache({ onError: reportUnexpectedError }),
    queryCache: new QueryCache({ onError: reportUnexpectedError }),
  });

  // Query's defaults would hold an offline navigation for seconds of retries, pause it until the
  // browser reports online, and collect the fallback value after five idle minutes
  queryClient.setQueryDefaults([LAST_KNOWN_QUERY_KEY_PREFIX], {
    gcTime: Number.POSITIVE_INFINITY,
    networkMode: 'always',
    retry: false,
  });

  return queryClient;
}

function shouldRetryError(failureCount: number, error: Error): boolean {
  if (failureCount >= 2) {
    return false;
  }

  return !(error instanceof ORPCError && error.status < 500);
}

function reportUnexpectedError(error: Error): void {
  if (
    error instanceof ORPCError ||
    error instanceof NetworkFailureError ||
    isRedirect(error) ||
    isNotFound(error)
  ) {
    return;
  }

  Sentry.captureException(error);
}
