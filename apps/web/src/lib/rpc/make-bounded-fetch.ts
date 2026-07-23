import type { ClientContext } from '@orpc/client';
import { ORPCError } from '@orpc/client';
import type { LinkFetchClientOptions } from '@orpc/client/fetch';
import type { ServiceName } from '@vers/service-auth';
import type { OutboundFailureMode } from '@vers/service-utils/orpc';
import { recordServiceCallFailure } from '../metrics/record-service-call-failure';
import { serviceDispatcher } from './service-dispatcher';
import type { ServiceFetchInit } from './types';

type BoundFetch = NonNullable<LinkFetchClientOptions<ClientContext>['fetch']>;

export interface MakeBoundedFetchOptions {
  readonly attemptTimeoutMs?: number;
  readonly service: ServiceName;
}

export const DEFAULT_ATTEMPT_TIMEOUTS_MS: ReadonlyArray<number> = [2000, 6000];

/**
 * Builds an `RPCLink` `fetch` that bounds a single outbound attempt to a timeout instead of
 * undici's multi-minute default — a request against a Fly machine whose autosuspend-era keep-alive
 * socket the pool still holds fails fast instead of hanging out that stale connection's idle
 * window. A timeout or transport failure converts to a thrown `ORPCError('SERVICE_UNAVAILABLE')`
 * tagged with its `data.failureMode` — `'transport'` when the request never reached the server,
 * `'timeout'` when the attempt's own bound fired instead — so the retry interceptor one layer up
 * can tell a request that never applied from one the server may have already processed. A
 * caller-driven abort (the request's own signal, not the attempt timeout) always rethrows
 * unconverted — that's the caller's decision, not a transport failure.
 */
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

      const reason: OutboundFailureMode = boundFired ? 'timeout' : 'transport';

      recordServiceCallFailure(options.service, reason);
      throw new ORPCError('SERVICE_UNAVAILABLE', { cause: error, data: { failureMode: reason } });
    }
  };
}
