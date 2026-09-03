import type { ClientContext } from '@orpc/client';
import { ORPCError } from '@orpc/client';
import type { LinkFetchClientOptions } from '@orpc/client/fetch';
import type { ServiceName } from '@vers/service-auth';
import { runBoundedAttempts } from './run-bounded-attempts';
import { serviceDispatcher } from './service-dispatcher';
import type { AttemptClock, ServiceFetchInit } from './types';

type BoundFetch = NonNullable<LinkFetchClientOptions<ClientContext>['fetch']>;

export interface MakeBoundedFetchOptions {
  readonly clock?: AttemptClock;
  readonly isRetryable: (path: ReadonlyArray<string>) => boolean;
  readonly service: ServiceName;
}

export function makeBoundedFetch(options: Readonly<MakeBoundedFetchOptions>): BoundFetch {
  return async (request, init, _clientOptions, path) => {
    const outcome = await runBoundedAttempts(
      {
        ...(options.clock !== undefined && { clock: options.clock }),
        retryable: options.isRetryable(path),
        service: options.service,
        signal: request.signal,
      },
      (signal) => {
        const requestInit: ServiceFetchInit = { ...init, dispatcher: serviceDispatcher, signal };

        // a Request's body is consumed by the send that reads it, so every attempt sends its own
        // clone
        return fetch(request.clone(), requestInit);
      },
    );

    if (outcome.kind === 'aborted') {
      throw outcome.cause;
    }

    if (outcome.kind === 'failed') {
      throw new ORPCError('SERVICE_UNAVAILABLE', { cause: outcome.cause });
    }

    return outcome.response;
  };
}
