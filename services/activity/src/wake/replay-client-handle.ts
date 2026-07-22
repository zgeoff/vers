import type { ContractRouterClient } from '@orpc/contract';
import type { replayContract } from '@vers/contract-replay';

/**
 * Process-wide holder for the lazily built replay RPC client: `current` stays undefined until the
 * first wake delivery builds it, and a build failure clears it back to undefined so the next
 * delivery retries the build fresh — a wake-call failure leaves an already-resolved `current`
 * untouched. `sendReplayWake` is its only production writer; tests reset it through the package's
 * test-only setter.
 */
export const replayClientHandle: {
  current: Promise<ContractRouterClient<typeof replayContract>> | undefined;
} = { current: undefined };
