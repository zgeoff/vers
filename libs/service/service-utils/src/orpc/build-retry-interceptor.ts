import type { ClientContext } from '@orpc/client';
import type { StandardLinkClientInterceptorOptions } from '@orpc/client/standard';
import type { Interceptor } from '@orpc/shared';
import type { StandardLazyResponse } from '@orpc/standard-server';
import invariant from 'tiny-invariant';

export interface RetryInterceptorOptions {
  /**
   * Growing per-attempt backoff floor in milliseconds; each retry waits `backoffMs * attempt`.
   */
  readonly backoffMs?: number;

  readonly isRetryable: (path: ReadonlyArray<string>) => boolean;

  /**
   * Number of retries beyond the first attempt — the default allows up to 3 attempts total.
   */
  readonly maxRetries?: number;

  /**
   * DI metrics hook invoked once per retry; omit it where the caller has no meter to record to.
   */
  readonly onRetry?: () => void;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 250;

/**
 * Builds an `RPCLink` `clientInterceptors` entry that retries a contract's idempotent procedures
 * on a transient failure — a 5xx response or a thrown transport error — with a growing linear
 * backoff between attempts. A non-retryable path (`isRetryable` reads GET/HEAD off the contract,
 * since only those can't double-apply) passes through unchanged after a single attempt. The
 * caller's own abort always ends the loop immediately, mid-attempt or mid-backoff, rather than
 * spending the remaining retry budget on a call nobody wants anymore.
 */
export function buildRetryInterceptor<T extends ClientContext = ClientContext>(
  options: Readonly<RetryInterceptorOptions>,
): Interceptor<StandardLinkClientInterceptorOptions<T>, Promise<StandardLazyResponse>> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;

  invariant(
    Number.isInteger(maxRetries) && maxRetries >= 0,
    'maxRetries must be a non-negative integer',
  );

  invariant(
    Number.isFinite(backoffMs) && backoffMs >= 0,
    'backoffMs must be a non-negative number',
  );

  return async (interceptorOptions) => {
    if (!options.isRetryable(interceptorOptions.path)) {
      return interceptorOptions.next();
    }

    const signal = interceptorOptions.request.signal;

    for (let attempt = 0; ; attempt += 1) {
      const isLastAttempt = attempt === maxRetries;

      try {
        const response = await interceptorOptions.next();

        if (response.status < 500 || isLastAttempt) {
          return response;
        }
      } catch (error) {
        if (signal?.aborted === true || isLastAttempt) {
          throw error;
        }
      }

      await waitOrAbort(backoffMs * (attempt + 1), signal);

      options.onRetry?.();
    }
  };
}

/**
 * Waits out `ms`, rejecting immediately with `signal`'s abort reason instead of running out the
 * clock once it aborts — a caller who cancels mid-backoff must not still wait it out. A link with
 * no request signal never aborts, so it always waits the full backoff.
 */
function waitOrAbort(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal === undefined) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

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
