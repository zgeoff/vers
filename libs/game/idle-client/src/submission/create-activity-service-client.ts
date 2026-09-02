import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { activityContract } from '@vers/contract-activity';
import { buildRetryInterceptor, makeIsRetryable } from '@vers/service-utils/orpc';
import { removeOfflineWork } from './remove-offline-work';
import type { ActivityCallContext, ActivityServiceClient } from './types';

const SESSION_SUPERSEDED_HEADER = 'x-session-superseded';

export function createActivityServiceClient(): ActivityServiceClient {
  // the discard in flight, shared by every call that observes the marker at once, and reset once it
  // settles: a takeover marks every concurrent call, and one clear answers all of them, while a
  // later takeover on this same worker must clear again rather than await a settled promise
  let discard: null | Promise<void> = null;

  const runDiscard = async (): Promise<void> => {
    try {
      await removeOfflineWork();
    } catch {
      // a failed clear leaves the work in place; the next marked refusal discards again
    } finally {
      discard = null;
    }
  };

  const link = new RPCLink<ActivityCallContext>({
    clientInterceptors: [buildRetryInterceptor({ isRetryable: makeIsRetryable(activityContract) })],

    fetch: async (input, init) => {
      const response = await fetch(input, init);

      if (response.headers.has(SESSION_SUPERSEDED_HEADER)) {
        discard ??= runDiscard();

        await discard;
      }

      return response;
    },

    // a call made with no options at all reaches this callback with an undefined context
    headers: (options) =>
      options.context?.traceparent === undefined
        ? {}
        : { traceparent: options.context.traceparent },
    url: `${self.location.origin}/api/rpc/activity`,
  });

  return createORPCClient(link);
}
