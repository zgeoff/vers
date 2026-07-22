import type { ClientContext } from '@orpc/client';
import { ORPCError } from '@orpc/client';
import type { LinkFetchClientOptions } from '@orpc/client/fetch';
import type { ServiceName } from '@vers/service-auth';
import invariant from 'tiny-invariant';
import { recordServiceCallFailure } from '../metrics/record-service-call-failure';
import { recordServiceCallRetry } from '../metrics/record-service-call-retry';
import { serviceDispatcher } from './service-dispatcher';
import type { ServiceFetchInit } from './types';

type BoundFetch = NonNullable<LinkFetchClientOptions<ClientContext>['fetch']>;

export interface MakeBoundedFetchOptions {
  readonly attemptTimeoutsMs?: ReadonlyArray<number>;
  readonly isRetryable: (path: ReadonlyArray<string>) => boolean;
  readonly retryBackoffMs?: number;
  readonly service: ServiceName;
}

export const DEFAULT_ATTEMPT_TIMEOUTS_MS: ReadonlyArray<number> = [2000, 6000];
const DEFAULT_RETRY_BACKOFF_MS = 250;

/**
 * Builds an `RPCLink` `fetch` that bounds every outbound call to a per-attempt timeout instead of
 * undici's multi-minute default — a request against a Fly machine whose autosuspend-era keep-alive
 * socket the pool still holds fails fast instead of hanging out that stale connection's idle
 * window. A retryable procedure (`isRetryable` reads GET/HEAD off the contract, since only those
 * can't double-apply) walks `attemptTimeoutsMs` in order with a growing backoff between attempts; a
 * non-retryable procedure gets a single attempt bounded by the largest entry. A caller-driven abort
 * (the request's own signal, not the per-attempt timeout) always rethrows unconverted and
 * unretried — that's the caller's decision, not a transport failure.
 */
export function makeBoundedFetch(options: MakeBoundedFetchOptions): BoundFetch {
  const attemptTimeoutsMs = options.attemptTimeoutsMs ?? DEFAULT_ATTEMPT_TIMEOUTS_MS;
  const retryBackoffMs = options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;

  return (request, init, _clientOptions, path) => {
    const bounds = options.isRetryable(path) ? attemptTimeoutsMs : [Math.max(...attemptTimeoutsMs)];

    return runAttempt({
      attemptIndex: 0,
      bounds,
      init,
      request,
      retryBackoffMs,
      service: options.service,
    });
  };
}

interface RunAttemptOptions {
  readonly attemptIndex: number;
  readonly bounds: ReadonlyArray<number>;
  readonly init: Readonly<{ redirect?: Request['redirect'] }>;
  readonly request: Request;
  readonly retryBackoffMs: number;
  readonly service: ServiceName;
}

async function runAttempt(options: RunAttemptOptions): Promise<Response> {
  const bound = options.bounds[options.attemptIndex];

  invariant(bound !== undefined, 'attemptIndex must stay within bounds');

  const controller = new AbortController();

  const signal = AbortSignal.any([options.request.signal, controller.signal]);
  let boundFired = false;

  const timer = setTimeout(() => {
    boundFired = true;

    controller.abort();
  }, bound);

  try {
    // `fetch` disturbs a `Request`'s body even on an aborted attempt, so the original must never
    // reach it directly — a retried attempt clones it fresh, leaving `options.request` untouched.
    // The timer is cleared the instant `fetch` resolves so the bound never outlives the response
    // headers — otherwise it stays armed through oRPC's lazy body read and can abort mid-stream.
    const requestInit: ServiceFetchInit = {
      ...options.init,
      dispatcher: serviceDispatcher,
      signal,
    };

    const response = await fetch(options.request.clone(), requestInit);

    clearTimeout(timer);

    return response;
  } catch (error) {
    clearTimeout(timer);

    if (options.request.signal.aborted) {
      throw error;
    }

    const isLastAttempt = options.attemptIndex === options.bounds.length - 1;

    if (isLastAttempt) {
      const reason = boundFired ? 'timeout' : 'transport';

      recordServiceCallFailure(options.service, reason);
      throw new ORPCError('SERVICE_UNAVAILABLE', { cause: error });
    }

    await waitOrAbort(options.retryBackoffMs * (options.attemptIndex + 1), options.request.signal);

    recordServiceCallRetry(options.service);

    return runAttempt({ ...options, attemptIndex: options.attemptIndex + 1 });
  }
}

/**
 * Waits out `ms`, rethrowing `signal`'s abort reason the instant it aborts instead of running out
 * the clock — a caller who cancels mid-backoff must not still wait it out.
 */
function waitOrAbort(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(normalizeAbortReason(signal.reason));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);

      resolve();
    }, ms);

    const onAbort = (): void => {
      clearTimeout(timer);
      reject(normalizeAbortReason(signal.reason));
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * `AbortSignal.reason` is typed `any`, so a caller-supplied reason that isn't already an `Error`
 * (a bare string, `undefined`) needs wrapping before it can reject a promise.
 */
function normalizeAbortReason(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}
