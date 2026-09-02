import type { ClientContext } from '@orpc/client';
import type { StandardLinkClientInterceptorOptions } from '@orpc/client/standard';
import type { Interceptor } from '@orpc/shared';
import type { StandardLazyResponse } from '@orpc/standard-server';
import invariant from 'tiny-invariant';

export interface RetryInterceptorOptions {
  readonly backoffMs?: number;

  readonly isRetryable: (path: ReadonlyArray<string>) => boolean;

  readonly maxRetries?: number;

  readonly onRetry?: () => void;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 250;

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

function normalizeAbortReason(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}
