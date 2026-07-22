import { replayClientHandle } from './replay-client-handle';

/**
 * Test-only writer that clears the cached replay client back to its initial, unbuilt state.
 * Production code never calls this — a build failure is `sendReplayWake`'s only production path
 * back to an unbuilt cache.
 */
export function resetReplayClientForTesting(): void {
  replayClientHandle.current = undefined;
}
