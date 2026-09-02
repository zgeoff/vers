import { ORPCError } from '@orpc/client';
import * as Sentry from '@sentry/react';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

export function buildQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetryError },
    },
    mutationCache: new MutationCache({ onError: reportUnexpectedError }),
    queryCache: new QueryCache({ onError: reportUnexpectedError }),
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
  if (error instanceof ORPCError) {
    return;
  }

  Sentry.captureException(error);
}
