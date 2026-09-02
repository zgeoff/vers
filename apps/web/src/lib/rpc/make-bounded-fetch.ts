import type { ClientContext } from '@orpc/client';
import { ORPCError } from '@orpc/client';
import type { LinkFetchClientOptions } from '@orpc/client/fetch';
import type { ServiceName } from '@vers/service-auth';
import { recordServiceCallFailure } from '../metrics/record-service-call-failure';
import { serviceDispatcher } from './service-dispatcher';
import type { ServiceFetchInit } from './types';

type BoundFetch = NonNullable<LinkFetchClientOptions<ClientContext>['fetch']>;

export interface MakeBoundedFetchOptions {
  readonly attemptTimeoutMs?: number;
  readonly service: ServiceName;
}

export const DEFAULT_ATTEMPT_TIMEOUTS_MS: ReadonlyArray<number> = [2000, 6000];

export function makeBoundedFetch(options: MakeBoundedFetchOptions): BoundFetch {
  const attemptTimeoutMs = options.attemptTimeoutMs ?? Math.max(...DEFAULT_ATTEMPT_TIMEOUTS_MS);

  return async (request, init) => {
    const controller = new AbortController();

    const signal = AbortSignal.any([request.signal, controller.signal]);
    let boundFired = false;

    const timer = setTimeout(() => {
      boundFired = true;

      controller.abort();
    }, attemptTimeoutMs);

    try {
      // The timer is cleared the instant `fetch` resolves so the bound never outlives the response
      // headers — otherwise it stays armed through oRPC's lazy body read and can abort mid-stream.
      const requestInit: ServiceFetchInit = { ...init, dispatcher: serviceDispatcher, signal };

      const response = await fetch(request, requestInit);

      clearTimeout(timer);

      return response;
    } catch (error) {
      clearTimeout(timer);

      if (request.signal.aborted) {
        throw error;
      }

      const reason = boundFired ? 'timeout' : 'transport';

      recordServiceCallFailure(options.service, reason);
      throw new ORPCError('SERVICE_UNAVAILABLE', { cause: error });
    }
  };
}
