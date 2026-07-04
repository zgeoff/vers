import { buildCheckpointHash } from './build-checkpoint-hash';
import { buildGenesisHash } from './build-genesis-hash';
import type { ActivityEvent } from './types';

export type HashChainReport = {
  valid: boolean;
  length: number;
  /** 0-based index of the first event whose link fails; absent when valid. */
  brokenAt?: number;
  reason?: string;
};

/**
 * The verifier path: recomputes every link of an activity's hash chain from
 * the replayed events and reports the first break, if any.
 */
export function checkHashChain(events: ActivityEvent[]): HashChainReport {
  const [first, ...rest] = events;
  if (!first) return { valid: false, length: 0, brokenAt: 0, reason: 'empty stream' };
  if (first.type !== 'ActivityStarted') {
    return { valid: false, length: events.length, brokenAt: 0, reason: 'stream must start with ActivityStarted' };
  }

  let chainHash = buildGenesisHash(first.data.activityId, first.data.seed);
  for (const [index, event] of rest.entries()) {
    if (event.type === 'ActivityStarted') {
      return { valid: false, length: events.length, brokenAt: index + 1, reason: 'duplicate ActivityStarted' };
    }
    if (event.data.prevHash !== chainHash) {
      return { valid: false, length: events.length, brokenAt: index + 1, reason: 'prevHash does not match chain' };
    }
    const payload =
      event.type === 'CheckpointBatchRecorded'
        ? { checkpoints: event.data.checkpoints, progress: event.data.progress }
        : { finalProgress: event.data.finalProgress };
    const expected = buildCheckpointHash(chainHash, payload);
    if (event.data.hash !== expected) {
      return { valid: false, length: events.length, brokenAt: index + 1, reason: 'hash does not match payload' };
    }
    chainHash = event.data.hash;
  }
  return { valid: true, length: events.length };
}
