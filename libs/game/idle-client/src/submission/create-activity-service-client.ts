import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { activityContract } from '@vers/contract-activity';
import {
  SESSION_SUPERSEDED_HEADER,
  makeIsRetryable,
  makeRetryInterceptor,
} from '@vers/service-utils/orpc';
import type { ActivityCallContext, ActivityServiceClient } from './types';

interface CreateActivityServiceClientHooks {
  readonly onExchangeFailed: (detail: string) => void;
  readonly onSessionSuperseded: () => void;
}

export function createActivityServiceClient(
  hooks: Readonly<CreateActivityServiceClientHooks>,
): ActivityServiceClient {
  const sendRequest = async (input: Request, init?: RequestInit): Promise<Response> => {
    const procedure = new URL(input.url).pathname.split('/').at(-1) ?? '';
    let response: Response;

    try {
      response = await fetch(input, init);
    } catch (error) {
      hooks.onExchangeFailed(
        `${procedure} unanswered ${error instanceof Error ? error.name : 'unknown'}`,
      );

      throw error;
    }

    if (!response.ok) {
      hooks.onExchangeFailed(`${procedure} answered ${response.status}`);
    }

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
