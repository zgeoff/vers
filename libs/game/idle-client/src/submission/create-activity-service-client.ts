import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { activityContract } from '@vers/contract-activity';
import { makeIsRetryable, makeRetryInterceptor } from '@vers/service-utils/orpc';
import type { ActivityCallContext, ActivityServiceClient } from './types';

const SESSION_SUPERSEDED_HEADER = 'x-session-superseded';

interface CreateActivityServiceClientHooks {
  readonly onSessionSuperseded: () => void;
}

export function createActivityServiceClient(
  hooks: Readonly<CreateActivityServiceClientHooks>,
): ActivityServiceClient {
  const sendRequest = async (input: Request, init?: RequestInit): Promise<Response> => {
    const response = await fetch(input, init);

    // reported, never awaited: the discard queues behind the flow in flight, and that flow may be
    // the one awaiting this very response
    if (response.headers.has(SESSION_SUPERSEDED_HEADER)) {
      hooks.onSessionSuperseded();
    }

    return response;
  };

  const link = new RPCLink<ActivityCallContext>({
    clientInterceptors: [makeRetryInterceptor({ isRetryable: makeIsRetryable(activityContract) })],

    fetch: sendRequest,

    // a call made with no options at all reaches this callback with an undefined context
    headers: (options) =>
      options.context?.traceparent === undefined
        ? {}
        : { traceparent: options.context.traceparent },
    url: `${self.location.origin}/api/rpc/activity`,
  });

  return createORPCClient(link);
}
