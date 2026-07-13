import type { Checkpoint, CheckpointPayload } from '@vers/contract-activity';
import type { ActivityCheckpoints } from '@vers/db';
import type { Selectable } from 'kysely';

/**
 * Maps a kysely `activity_checkpoints` row onto the contract's `Checkpoint` shape. `payload` is
 * cast to `CheckpointPayload`: the column is untyped jsonb, every write is schema-validated
 * contract input, and the cast cannot smuggle a drifted row past the RPC boundary — oRPC validates
 * handler output against the contract's output schema and fails the request on mismatch.
 */
export function toCheckpointData(row: Readonly<Selectable<ActivityCheckpoints>>): Checkpoint {
  return {
    appendedAt: row.appendedAt,
    hash: row.hash,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; every write is schema-validated contract input, and oRPC's output validation rejects a drifted shape at the boundary
    payload: row.payload as CheckpointPayload,
    prevHash: row.prevHash,
    version: row.version,
  };
}
