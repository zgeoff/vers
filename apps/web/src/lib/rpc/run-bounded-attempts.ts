import type { ServiceName } from '@vers/service-auth';
import invariant from 'tiny-invariant';
import type { ServiceCallFailureReason } from '../metrics/record-service-call-failure';
import { recordServiceCallFailure } from '../metrics/record-service-call-failure';
import { recordServiceCallRetry } from '../metrics/record-service-call-retry';
import type { AttemptClock } from './types';

export interface RunBoundedAttemptsOptions {
  readonly clock?: AttemptClock;
  readonly retryable: boolean;
  readonly service: ServiceName;
  readonly signal: AbortSignal;
}

export type BoundedAttemptsOutcome =
  | { readonly cause: unknown; readonly kind: 'aborted' }
  | { readonly cause: unknown; readonly kind: 'failed'; readonly reason: ServiceCallFailureReason }
  | { readonly kind: 'delivered'; readonly response: Response };

// the last bound holds the window open for a Fly machine that falls back to a cold start, which has
// answered its first request as late as 21s after that request arrived
const RETRYABLE_ATTEMPT_TIMEOUTS_MS: ReadonlyArray<number> = [2000, 6000, 16_000];

// a call that cannot be resent waits out the same wall-clock budget in one attempt
const SINGLE_ATTEMPT_TIMEOUTS_MS: ReadonlyArray<number> = [24_000];
const globalClock: AttemptClock = { clearTimeout, setTimeout };

export async function runBoundedAttempts(
  options: Readonly<RunBoundedAttemptsOptions>,
  sendAttempt: (signal: AbortSignal) => Promise<Response>,
): Promise<BoundedAttemptsOutcome> {
  const clock = options.clock ?? globalClock;
  const timeouts = options.retryable ? RETRYABLE_ATTEMPT_TIMEOUTS_MS : SINGLE_ATTEMPT_TIMEOUTS_MS;

  for (let index = 0; ; index += 1) {
    if (options.signal.aborted) {
      return { cause: options.signal.reason, kind: 'aborted' };
    }

    const timeoutMs = timeouts[index];

    invariant(timeoutMs !== undefined, 'attempt index ran past the timeout table');

    const isLastAttempt = index === timeouts.length - 1;

    if (index > 0) {
      recordServiceCallRetry(options.service);
    }

    const attempt = await sendBoundedAttempt(clock, options.signal, timeoutMs, sendAttempt);

    if (attempt.kind === 'response') {
      if (attempt.response.status < 500 || isLastAttempt) {
        return { kind: 'delivered', response: attempt.response };
      }

      try {
        await attempt.response.body?.cancel();
      } catch {
        // an errored body rejects its own cancel; the socket is released either way
      }
    } else if (options.signal.aborted) {
      return { cause: attempt.cause, kind: 'aborted' };
    } else if (isLastAttempt) {
      const reason: ServiceCallFailureReason = attempt.boundFired ? 'timeout' : 'transport';

      recordServiceCallFailure(options.service, reason);

      return { cause: attempt.cause, kind: 'failed', reason };
    }
  }
}

type AttemptResult =
  | { readonly boundFired: boolean; readonly cause: unknown; readonly kind: 'threw' }
  | { readonly kind: 'response'; readonly response: Response };

async function sendBoundedAttempt(
  clock: AttemptClock,
  callerSignal: AbortSignal,
  timeoutMs: number,
  sendAttempt: (signal: AbortSignal) => Promise<Response>,
): Promise<AttemptResult> {
  const controller = new AbortController();

  const signal = AbortSignal.any([callerSignal, controller.signal]);
  let boundFired = false;

  const timer: unknown = clock.setTimeout(() => {
    boundFired = true;

    controller.abort();
  }, timeoutMs);

  try {
    // the bound is disarmed the instant the response headers arrive, so it never outlives them and
    // aborts a lazy body read
    return { kind: 'response', response: await sendAttempt(signal) };
  } catch (error) {
    return { boundFired, cause: error, kind: 'threw' };
  } finally {
    clock.clearTimeout(timer);
  }
}
