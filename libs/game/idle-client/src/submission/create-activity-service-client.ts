import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ActivityCallContext, ActivityServiceClient } from './types';

/**
 * Builds the worker's activity service client: a same-origin `RPCLink` pointed at the
 * `/api/rpc/activity` proxy, built from `self.location.origin` since a `SharedWorker` has no
 * ambient server request to read headers from. The proxy mints the outbound s2s token from the
 * session cookie `fetch` sends by default on a same-origin request, and forwards a caller-minted
 * `traceparent` untouched so the service continues that trace.
 */
export function createActivityServiceClient(): ActivityServiceClient {
  const link = new RPCLink<ActivityCallContext>({
    // a call made with no options at all reaches this callback with an undefined context
    headers: (options) =>
      options.context?.traceparent === undefined
        ? {}
        : { traceparent: options.context.traceparent },
    url: `${self.location.origin}/api/rpc/activity`,
  });

  return createORPCClient(link);
}
