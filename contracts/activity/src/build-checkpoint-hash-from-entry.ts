import { buildCheckpointHash } from './build-checkpoint-hash';
import type { CheckpointBatchEntry } from './checkpoint-batch-entry-schema';

/**
 * Maps a checkpoint batch entry to its chain-link hash: the entry's own `prevHash` and `version`
 * over the hashed subset of its payload, so a recomputed hash can be compared against the entry's
 * submitted `hash`.
 */
export function buildCheckpointHashFromEntry(entry: Readonly<CheckpointBatchEntry>): string {
  return buildCheckpointHash({
    chainIndex: entry.payload.chainIndex,
    entropySource: entry.payload.entropySource,
    nextSeed: entry.payload.nextSeed,
    prevHash: entry.prevHash,
    seed: entry.payload.seed,
    time: entry.payload.time,
    type: entry.payload.type,
    version: entry.version,
  });
}
