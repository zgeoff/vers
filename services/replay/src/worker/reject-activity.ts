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

/**
 * Rejects an activity on reproducible divergence: the activity itself terminates — from `active`
 * (divergence mid-stream) or its own optimistic `stopped`/`capped` forward-exit (divergence caught
 * on a batch already flushed) — the chain's appended anchor rewinds to its still-trustworthy
 * verified anchor in one self-referential update, and any successor already rooted past the
 * verified point voids too, whether it is still `active` or has itself forward-exited to
 * `stopped`/`capped` — its forward-advance compare-and-swap could no longer match anyway, so this
 * just settles it explicitly. The target activity's own transition is the guard: a stale call
 * whose row no longer matches applies nothing, including the chain rewind and successor void, and
 * reports `applied: false`. The three writes are structurally atomic: runs inside the caller's
 * transaction when given one (composing with a held chain claim), or opens its own otherwise.
 */
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
