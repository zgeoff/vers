import type { Checkpoint, CheckpointPayload } from '@vers/contract-activity';
import type { ActivityCheckpoints } from '@vers/db';
import type { Selectable } from 'kysely';

/**
 * Maps a kysely `activity_checkpoints` row onto the contract's `Checkpoint` shape. `payload` is
 * cast to `CheckpointPayload`: the column is untyped jsonb, but every write is
 * `CheckpointPayloadSchema`-validated contract input.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the row's jsonb `payload` field types as the generated `Json` union, which nests a mutable `JsonValue[]` branch with no readonly form
export function toCheckpointData(row: Readonly<Selectable<ActivityCheckpoints>>): Checkpoint {
  return {
    appendedAt: row.appendedAt,
    hash: row.hash,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; every write is CheckpointPayloadSchema-validated contract input
    payload: row.payload as CheckpointPayload,
    prevHash: row.prevHash,
    version: row.version,
  };
}
