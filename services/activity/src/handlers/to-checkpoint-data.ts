import type { Checkpoint } from '@vers/contract-activity';
import { CheckpointPayloadSchema } from '@vers/contract-activity';
import type { ActivityCheckpoints } from '@vers/db';
import type { Selectable } from 'kysely';

/**
 * Maps a kysely `activity_checkpoints` row onto the contract's `Checkpoint` shape. `payload` is an
 * untyped jsonb column and re-enters typed code through its contract schema, so a drifted row
 * fails here loudly instead of flowing on.
 */
export function toCheckpointData(row: Readonly<Selectable<ActivityCheckpoints>>): Checkpoint {
  return {
    appendedAt: row.appendedAt,
    hash: row.hash,
    payload: CheckpointPayloadSchema.parse(row.payload),
    prevHash: row.prevHash,
    version: row.version,
  };
}
