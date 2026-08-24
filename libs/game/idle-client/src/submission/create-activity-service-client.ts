import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { activityContract } from '@vers/contract-activity';
import { buildRetryInterceptor, makeIsRetryable } from '@vers/service-utils/orpc';
import { removeOfflineWork } from './remove-offline-work';
import type { ActivityCallContext, ActivityServiceClient } from './types';

/**
 * The response header the app's RPC proxy sets on a call whose session row was deleted before its
 * expiry — an account taken over on another device, a sign-out, or a reuse revocation. A session
 * that merely ran out of lifetime is refused without it, so its offline work survives.
 */
const SESSION_SUPERSEDED_HEADER = 'x-session-superseded';

/**
 * Builds the worker's activity service client: a same-origin `RPCLink` pointed at the
 * `/api/rpc/activity` proxy, built from `self.location.origin` since a `SharedWorker` has no
 * ambient server request to read headers from. The proxy mints the outbound s2s token from the
 * session cookie `fetch` sends by default on a same-origin request, and forwards a caller-minted
 * `traceparent` untouched so the service continues that trace. Retries the contract's idempotent
 * procedures on a transient failure, absorbing a cold-resumed service's brief unavailability
 * instead of surfacing it to a resync in progress.
 *
 * Every call the worker makes passes through this client's `fetch`, which is why the discard of a
 * superseded session's offline work is settled here rather than at each caller: a checkpoint flush
 * and a resync both learn of the takeover from whichever of them happens to run first.
 */
export function createActivityServiceClient(): ActivityServiceClient {
  // the one discard this client ever runs: a takeover marks every concurrent call at once, and
  // clearing the same stores repeatedly would race the transaction against itself for no gain
  let discard: null | Promise<void> = null;

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

/**
 * Clears the device's undelivered offline work, swallowing a failure. The discard is cleanup the
 * calling procedure cannot act on, and that call must still return the refusal that triggered it,
 * so the flow above renders a signed-out state rather than a fault.
 */
async function runDiscard(): Promise<void> {
  try {
    await removeOfflineWork();
  } catch {
    // a failed clear leaves the work in place; the next refused call retries the discard
  }
}
