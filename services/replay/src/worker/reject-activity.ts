import type { DB } from '@vers/db';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';

interface RejectActivityInput {
  readonly activityID: string;
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

interface RejectActivityResult {
  readonly applied: boolean;
}

export function rejectActivity(
  db: Kysely<DB>,
  input: Readonly<RejectActivityInput>,
): Promise<RejectActivityResult> {
  if (db.isTransaction) {
    return applyRejectionWrites(db, input);
  }

  return db.transaction().execute((trx) => applyRejectionWrites(trx, input));
}

async function applyRejectionWrites(
  trx: Kysely<DB>,
  input: Readonly<RejectActivityInput>,
): Promise<RejectActivityResult> {
  const target = await trx
    .updateTable('activities')
    .set({ status: 'rejected', stoppedAt: sql`now()` })
    .where('id', '=', input.activityID)
    .where('status', 'in', ['active', 'stopped', 'capped'])
    .returning('id')
    .executeTakeFirst();

  if (target === undefined) {
    return { applied: false };
  }

  await trx
    .updateTable('activityChains')
    .set({
      appendedChainIndex: sql`verified_chain_index`,
      appendedNextSeed: sql`verified_next_seed`,
    })
    .where('avatarId', '=', input.avatarID)
    .where('scopeType', '=', input.scopeType)
    .where('scopeId', '=', input.scopeID)
    .execute();

  await trx
    .updateTable('activities')
    .set({ status: 'rejected', stoppedAt: sql`now()` })
    .where('avatarId', '=', input.avatarID)
    .where('scopeType', '=', input.scopeType)
    .where('scopeId', '=', input.scopeID)
    .where('status', 'in', ['active', 'stopped', 'capped'])
    .where('startChainIndex', '>', (eb) =>
      eb
        .selectFrom('activityChains')
        .select('verifiedChainIndex')
        .where('avatarId', '=', input.avatarID)
        .where('scopeType', '=', input.scopeType)
        .where('scopeId', '=', input.scopeID),
    )
    .execute();

  return { applied: true };
}
