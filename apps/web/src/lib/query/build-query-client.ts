import { ORPCError } from '@orpc/client';
import * as Sentry from '@sentry/react';
import { broadcastQueryClient } from '@tanstack/query-broadcast-client-experimental';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

/**
 * Builds the app's query client with the shared error policy: declared service errors and other
 * 4xx responses never retry (retrying can't change the outcome), transient failures — network
 * errors and 5xx — retry twice, and errors born in the client itself are reported once per error
 * at the cache layer, where no per-hook handler can shadow the report. On the browser it also wires
 * cross-tab cache sync over `BroadcastChannel`, so a cache change in one tab invalidates the same
 * query in every other open tab; this module also runs on the server during SSR, where
 * `BroadcastChannel` doesn't exist, so that wiring is guarded to the client only.
 */
export function buildQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetryError },
    },
    mutationCache: new MutationCache({ onError: reportUnexpectedError }),
    queryCache: new QueryCache({ onError: reportUnexpectedError }),
  });

  if (globalThis.window !== undefined && typeof BroadcastChannel !== 'undefined') {
    broadcastQueryClient({ broadcastChannel: 'vers-query', queryClient });
  }

  return queryClient;
}

function shouldRetryError(failureCount: number, error: Error): boolean {
  if (failureCount >= 2) {
    return false;
  }

  return !(error instanceof ORPCError && error.status < 500);
}

/**
 * Service-side failures (any `ORPCError`) are already logged and reported by the service that
 * produced them; reporting here would double them up. What only this tier can see — network
 * failures and bugs in client code — is what gets shipped.
 */
function reportUnexpectedError(error: Error): void {
  if (error instanceof ORPCError) {
    return;
  }

  Sentry.captureException(error);
}
