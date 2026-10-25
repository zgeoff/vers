import { CheckpointPayloadSchema } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import { updateVerifiedChainAnchor } from '../apply/update-verified-chain-anchor';

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
    .returning('verifiedHead')
    .executeTakeFirst();

  if (target === undefined) {
    return { applied: false };
  }

  if (target.verifiedHead > 0) {
    await updateAnchorToProvedTail(trx, input, target.verifiedHead);
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

// A segment the activity proved before it diverged is already paid, so a rewind that left its
// positions unspent would let the next activity on the chain draw and pay them again.
async function updateAnchorToProvedTail(
  trx: Kysely<DB>,
  input: Readonly<RejectActivityInput>,
  verifiedHead: number,
): Promise<void> {
  const tail = await trx
    .selectFrom('activityCheckpoints')
    .select('payload')
    .where('activityId', '=', input.activityID)
    .where('version', '=', verifiedHead)
    .executeTakeFirst();

  invariant(tail, 'a verified head always points at a stored checkpoint');

  const payload = CheckpointPayloadSchema.parse(tail.payload);

  if (payload.type === 'started') {
    return;
  }

  await updateVerifiedChainAnchor(trx, {
    avatarID: input.avatarID,
    chainIndex: payload.chainIndex,
    nextSeed: payload.nextSeed,
    scopeID: input.scopeID,
    scopeType: input.scopeType,
  });
}
