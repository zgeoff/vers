import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { replayContract } from '@vers/contract-replay';
import { createServiceToken, parseServicePrivateKey } from '@vers/service-auth';
import { buildTracingInterceptor } from '@vers/service-utils/orpc';
import invariant from 'tiny-invariant';
import { makeReplayWaker } from './make-replay-waker';
import { replayClientHandle } from './replay-client-handle';

const WAKE_COALESCE_WINDOW_MS = 1000;
const MAX_DELIVERY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 250;
const PER_ATTEMPT_TIMEOUT_MS = 2000;

/**
 * Pokes the replay service that a committed append advanced claimable verification work. Fire-and-
 * forget and level-triggered — one call means "there is work, come drain", so calling on every
 * advance is fine: the poke coalesces, retries a hung or failed delivery, and self-heals a lost one
 * on the next append. Never throws into the caller. The client is built lazily on the first
 * delivery, so importing this module never reads the environment.
 */
export const sendReplayWake = makeReplayWaker({
  coalesceWindowMs: WAKE_COALESCE_WINDOW_MS,
  maxDeliveryAttempts: MAX_DELIVERY_ATTEMPTS,
  perAttemptTimeoutMs: PER_ATTEMPT_TIMEOUT_MS,
  retryBackoffMs: RETRY_BACKOFF_MS,
  sendWake: (attempt) => sendWakeRequest(attempt.signal),
}).sendReplayWake;

async function sendWakeRequest(signal: AbortSignal): Promise<unknown> {
  replayClientHandle.current ??= buildReplayClient();

  // A build failure clears the cache so the next wake retries it fresh; a wake-call failure below
  // leaves an already-resolved handle untouched, since only this await sits inside the catch.
  let client: ContractRouterClient<typeof replayContract>;

  try {
    client = await replayClientHandle.current;
  } catch (error) {
    replayClientHandle.current = undefined;
    throw error;
  }

  return client.wake({}, { signal });
}

async function buildReplayClient(): Promise<ContractRouterClient<typeof replayContract>> {
  const privateKey = await parseServicePrivateKey(readRequiredEnv('SERVICE_AUTH_PRIVATE_KEY'));

  return createORPCClient(
    new RPCLink({
      clientInterceptors: [buildTracingInterceptor()],
      headers: async () => ({
        authorization: `Bearer ${await createServiceToken({ audience: 'replay', issuer: 'service-activity', privateKey })}`,
      }),
      url: `${readRequiredEnv('REPLAY_SERVICE_URL')}/rpc`,
    }),
  );
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  invariant(value !== undefined, `${name} must be set before this module ever loads`);

  return value;
}
