import { buildCheckpointHash } from './build-checkpoint-hash';
import type { CheckpointBatchEntry } from './checkpoint-batch-entry-schema';

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
