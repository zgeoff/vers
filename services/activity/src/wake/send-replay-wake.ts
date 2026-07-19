import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { replayContract } from '@vers/contract-replay';
import { createServiceToken, parseServicePrivateKey } from '@vers/service-auth';
import { buildTracingInterceptor } from '@vers/service-utils/orpc';
import invariant from 'tiny-invariant';
import { recordReplayPokeFailed } from '../metrics/record-replay-poke-failed';

const WAKE_COALESCE_WINDOW_MS = 1000;
const MAX_DELIVERY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 250;
const PER_ATTEMPT_TIMEOUT_MS = 2000;
let cooldownUntil = 0;
let deliveryInFlight: Promise<void> | undefined;

/**
 * Pokes the replay service that a committed append advanced claimable verification work. Fire-
 * and-forget and level-triggered — one call means "there is work, come drain", so calling on every
 * advance is fine: a burst inside the coalesce window collapses onto the delivery already in
 * flight, and a replay machine that's already draining treats a redundant wake as a no-op. At most
 * one delivery runs at a time: a call arriving while one is still in flight — a slow delivery can
 * outlast the coalesce window — coalesces onto it instead of starting a second. Each attempt is
 * bounded by a per-attempt timeout, so a hung request aborts, counts as a failed attempt, and
 * retries. Never throws — a delivery that exhausts its retries is a poke lost, not a caller failure,
 * and the next append's own call self-heals it.
 */
export function sendReplayWake(): void {
  const now = Date.now();

  if (now < cooldownUntil) {
    return;
  }

  cooldownUntil = now + WAKE_COALESCE_WINDOW_MS;

  if (deliveryInFlight !== undefined) {
    return;
  }

  deliveryInFlight = runDelivery();
}

async function runDelivery(): Promise<void> {
  try {
    await sendReplayWakeWithRetry();
  } finally {
    deliveryInFlight = undefined;
  }
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  invariant(value !== undefined, `${name} must be set before this module ever loads`);

  return value;
}

const privateKey = await parseServicePrivateKey(readRequiredEnv('SERVICE_AUTH_PRIVATE_KEY'));

const client: ContractRouterClient<typeof replayContract> = createORPCClient(
  new RPCLink({
    clientInterceptors: [buildTracingInterceptor()],
    headers: async () => ({
      authorization: `Bearer ${await createServiceToken({ audience: 'replay', privateKey })}`,
    }),
    url: `${readRequiredEnv('REPLAY_SERVICE_URL')}/rpc`,
  }),
);

async function sendReplayWakeWithRetry(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt += 1) {
    try {
      await client.wake({}, { signal: AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS) });

      return;
    } catch {
      if (attempt === MAX_DELIVERY_ATTEMPTS) {
        recordReplayPokeFailed();

        return;
      }

      await wait(RETRY_BACKOFF_MS * attempt);
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
