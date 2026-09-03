import type { Checkpoint } from '@vers/contract-activity';
import { CheckpointPayloadSchema } from '@vers/contract-activity';
import type { ActivityCheckpoints } from '@vers/db';
import type { Selectable } from 'kysely';

export function toCheckpointData(row: Readonly<Selectable<ActivityCheckpoints>>): Checkpoint {
  return {
    appendedAt: row.appendedAt,
    hash: row.hash,
    payload: CheckpointPayloadSchema.parse(row.payload),
    prevHash: row.prevHash,
    version: row.version,
  };
}
