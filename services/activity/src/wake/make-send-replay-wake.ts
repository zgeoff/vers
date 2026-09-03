import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { replayContract } from '@vers/contract-replay';
import { createServiceToken, parseServicePrivateKey } from '@vers/service-auth';
import { buildTracingInterceptor } from '@vers/service-utils/orpc';
import invariant from 'tiny-invariant';
import { makeReplayWaker } from './make-replay-waker';

const WAKE_COALESCE_WINDOW_MS = 1000;
const MAX_DELIVERY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 250;
const PER_ATTEMPT_TIMEOUT_MS = 2000;

interface MakeSendReplayWakeOptions {
  readonly coalesceWindowMs?: number;
}

export function makeSendReplayWake(options: MakeSendReplayWakeOptions = {}): () => void {
  // The lazily built client for this instance: undefined until the first delivery builds it, a
  // build failure clears it back to undefined so the next delivery retries the build fresh, and a
  // wake-call failure leaves an already-resolved client cached.
  let clientPromise: Promise<ContractRouterClient<typeof replayContract>> | undefined;

  const sendWakeRequest = async (signal: AbortSignal): Promise<unknown> => {
    clientPromise ??= buildReplayClient();

    // A build failure clears the cache so the next wake retries it fresh; a wake-call failure below
    // leaves an already-resolved handle untouched, since only this await sits inside the catch.
    let client: ContractRouterClient<typeof replayContract>;

    try {
      client = await clientPromise;
    } catch (error) {
      clientPromise = undefined;
      throw error;
    }

    return client.wake({}, { signal });
  };

  return makeReplayWaker({
    coalesceWindowMs: options.coalesceWindowMs ?? WAKE_COALESCE_WINDOW_MS,
    maxDeliveryAttempts: MAX_DELIVERY_ATTEMPTS,
    perAttemptTimeoutMs: PER_ATTEMPT_TIMEOUT_MS,
    retryBackoffMs: RETRY_BACKOFF_MS,
    sendWake: (attempt) => sendWakeRequest(attempt.signal),
  }).sendReplayWake;
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

  invariant(value !== undefined, `${name} must be set before the first wake delivery`);

  return value;
}
