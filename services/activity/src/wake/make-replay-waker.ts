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
}

interface ReplayWaker {
  readonly sendReplayWake: () => void;

  readonly waitUntilSettled: () => Promise<void>;
}

export function makeReplayWaker(options: ReplayWakerOptions): ReplayWaker {
  let cooldownUntil = 0;
  let deliveryInFlight: Promise<void> | undefined;

  const sendWakeWithRetry = async (): Promise<void> => {
    for (let attempt = 1; attempt <= options.maxDeliveryAttempts; attempt += 1) {
      try {
        await options.sendWake({ signal: AbortSignal.timeout(options.perAttemptTimeoutMs) });

        return;
      } catch {
        if (attempt === options.maxDeliveryAttempts) {
          recordReplayPokeFailed();

          // the infra program's poke-failed alarm matches this line, so a reworded message lets a
          // lost wake go unalarmed
          options.logger.warn('replay wake poke failed after every retry', {
            attempts: options.maxDeliveryAttempts,
          });

          return;
        }

        await wait(options.retryBackoffMs * attempt);
      }
    }
  };

  const runDelivery = async (): Promise<void> => {
    try {
      await sendWakeWithRetry();
    } finally {
      deliveryInFlight = undefined;
    }
  };

  const sendReplayWake = (): void => {
    const now = Date.now();

    if (now < cooldownUntil) {
      return;
    }

    cooldownUntil = now + options.coalesceWindowMs;

    if (deliveryInFlight !== undefined) {
      return;
    }

    deliveryInFlight = runDelivery();
  };

  const waitUntilSettled = (): Promise<void> => deliveryInFlight ?? Promise.resolve();

  return { sendReplayWake, waitUntilSettled };
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
