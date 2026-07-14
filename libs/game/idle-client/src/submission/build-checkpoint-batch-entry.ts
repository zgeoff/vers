import type {
  CheckpointBatchEntry,
  CheckpointPayload,
  EntropySource,
} from '@vers/contract-activity';
import { buildCheckpointHash } from '@vers/contract-activity';
import type { ActivityCheckpoint } from '@vers/idle-core';
import { ActivityCheckpointType } from '@vers/idle-core';

interface BuildCheckpointBatchEntryInput {
  readonly checkpoint: ActivityCheckpoint;
  readonly entropySource: EntropySource;
  readonly prevHash: string;
  readonly previousNextSeed: string;
  readonly startChainIndex: number;
  readonly version: number;
}

/**
 * Maps one engine checkpoint onto the wire `CheckpointBatchEntry` the activity service validates,
 * computing the same hash digest the server recomputes from the batch. `Started` carries its own
 * `seed`; every other checkpoint's `seed` is the chain position it started from, which the caller
 * threads in as `previousNextSeed` — the prior checkpoint's `nextSeed`, or the activity's own seed
 * for the stream's first entry.
 */
export function buildCheckpointBatchEntry(
  input: Readonly<BuildCheckpointBatchEntryInput>,
): CheckpointBatchEntry {
  const checkpoint = input.checkpoint;
  const chainIndex = input.startChainIndex + input.version;

  const seed =
    checkpoint.type === ActivityCheckpointType.Started ? checkpoint.seed : input.previousNextSeed;

  const hash = buildCheckpointHash({
    chainIndex,
    entropySource: input.entropySource,
    nextSeed: checkpoint.nextSeed,
    prevHash: input.prevHash,
    seed,
    time: checkpoint.time,
    type: checkpoint.type,
    version: input.version,
  });

  const payload: CheckpointPayload = {
    ...checkpoint,
    chainIndex,
    entropySource: input.entropySource,
    seed,
  };

  return { hash, payload, prevHash: input.prevHash, version: input.version };
}
