import type { DB } from '@vers/db';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';

interface RejectActivityInput {
  readonly activityID: string;
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

/**
 * Rejects an activity on reproducible divergence: the activity itself terminates — from `active`
 * (divergence mid-stream) or its own optimistic `stopped`/`capped` forward-exit (divergence caught
 * on a batch already flushed) — the chain's appended anchor rewinds to its still-trustworthy
 * verified anchor in one self-referential update, and any successor already rooted past the
 * verified point voids too — its forward-advance compare-and-swap could no longer match anyway, so
 * this just settles it explicitly. Runs inside the caller's transaction, alongside the chain claim
 * it composes with.
 */
export async function rejectActivity(
  db: Kysely<DB>,
  input: Readonly<RejectActivityInput>,
): Promise<void> {
  await db
    .updateTable('activities')
    .set({ status: 'rejected', stoppedAt: sql`now()` })
    .where('id', '=', input.activityID)
    .where('status', 'in', ['active', 'stopped', 'capped'])
    .execute();

  await db
    .updateTable('activityChains')
    .set({
      appendedChainIndex: sql`verified_chain_index`,
      appendedNextSeed: sql`verified_next_seed`,
    })
    .where('avatarId', '=', input.avatarID)
    .where('scopeType', '=', input.scopeType)
    .where('scopeId', '=', input.scopeID)
    .execute();

  await db
    .updateTable('activities')
    .set({ status: 'rejected', stoppedAt: sql`now()` })
    .where('avatarId', '=', input.avatarID)
    .where('scopeType', '=', input.scopeType)
    .where('scopeId', '=', input.scopeID)
    .where('status', '=', 'active')
    .where('startChainIndex', '>', (eb) =>
      eb
        .selectFrom('activityChains')
        .select('verifiedChainIndex')
        .where('avatarId', '=', input.avatarID)
        .where('scopeType', '=', input.scopeType)
        .where('scopeId', '=', input.scopeID),
    )
    .execute();
}
