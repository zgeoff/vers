import { recordReplayPokeFailed } from '../metrics/record-replay-poke-failed';

export interface WakeAttempt {
  readonly signal: AbortSignal;
}

interface ReplayWakerOptions {
  /**
   * Window after a delivery starts during which further calls are dropped rather than starting a
   * new one — a burst of appends collapses onto the delivery already going out.
   */
  readonly coalesceWindowMs: number;
  readonly maxDeliveryAttempts: number;
  readonly perAttemptTimeoutMs: number;
  readonly retryBackoffMs: number;

  /**
   * Transmits one wake to the replay service, aborting when the signal fires. Resolves on delivery
   * and rejects on transport failure or abort; its resolved value is ignored.
   */
  readonly sendWake: (options: WakeAttempt) => Promise<unknown>;
}

interface ReplayWaker {
  readonly sendReplayWake: () => void;

  /**
   * Resolves once the delivery currently in flight settles, or immediately when none is — the hook
   * a test awaits instead of sleeping out real timers.
   */
  readonly waitUntilSettled: () => Promise<void>;
}

/**
 * Builds a level-triggered wake poke over an injected delivery: at most one delivery runs at a
 * time, a burst inside the coalesce window collapses onto it, and each attempt is bounded by a
 * per-attempt timeout so a hung request aborts, counts as failed, and retries. A delivery that
 * exhausts its retries records the poke-failure counter and is swallowed — a lost poke, not a
 * caller failure, self-healed by the next append's own call.
 */
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
