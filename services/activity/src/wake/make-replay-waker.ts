import type { Logger } from '@vers/service-runtime/logging';
import { recordReplayPokeFailed } from '../metrics/record-replay-poke-failed';

export interface WakeAttempt {
  readonly signal: AbortSignal;
}

interface ReplayWakerOptions {
  readonly coalesceWindowMs: number;
  readonly logger: Logger;
  readonly maxDeliveryAttempts: number;
  readonly perAttemptTimeoutMs: number;
  readonly retryBackoffMs: number;

  readonly sendWake: (options: WakeAttempt) => Promise<unknown>;

  readonly signal?: AbortSignal;
}

interface ReplayWaker {
  readonly sendReplayWake: () => void;

  readonly waitUntilSettled: () => Promise<void>;
}

export function makeReplayWaker(options: ReplayWakerOptions): ReplayWaker {
  const lifetime = options.signal ?? new AbortController().signal;
  let cooldownUntil = 0;
  let deliveryInFlight: Promise<void> | undefined;
  let wakeRequested = false;

  const sendWakeWithRetry = async (): Promise<void> => {
    for (let attempt = 1; attempt <= options.maxDeliveryAttempts; attempt += 1) {
      try {
        await options.sendWake({
          signal: AbortSignal.any([AbortSignal.timeout(options.perAttemptTimeoutMs), lifetime]),
        });

        return;
      } catch {
        if (lifetime.aborted) {
          return;
        }

        if (attempt === options.maxDeliveryAttempts) {
          recordReplayPokeFailed();

          // the infra program's poke-failed alarm matches this line, so a reworded message lets a
          // lost wake go unalarmed
          options.logger.warn('replay wake poke failed after every retry', {
            attempts: options.maxDeliveryAttempts,
          });

          return;
        }

        await wait(options.retryBackoffMs * attempt, lifetime);
      }
    }
  };

  // the verifier can finish its drain between an append's commit and the wake that append asks
  // for, so a wake coalesced into an earlier delivery is sent again once the window closes
  const runDelivery = async (): Promise<void> => {
    try {
      while (wakeRequested) {
        await wait(Math.max(0, cooldownUntil - Date.now()), lifetime);

        if (lifetime.aborted) {
          return;
        }

        wakeRequested = false;
        cooldownUntil = Date.now() + options.coalesceWindowMs;

        await sendWakeWithRetry();
      }
    } finally {
      deliveryInFlight = undefined;
    }
  };

  const sendReplayWake = (): void => {
    if (lifetime.aborted) {
      return;
    }

    wakeRequested = true;
    deliveryInFlight ??= runDelivery();
  };

  const waitUntilSettled = (): Promise<void> => deliveryInFlight ?? Promise.resolve();

  return { sendReplayWake, waitUntilSettled };
}

function wait(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();

      return;
    }

    const settle = (): void => {
      clearTimeout(timer);

      signal.removeEventListener('abort', settle);

      resolve();
    };

    const timer = setTimeout(settle, delayMs);

    signal.addEventListener('abort', settle, { once: true });
  });
}
