import { CheckpointPayloadSchema } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';

interface FindVerifiedAnchorPredecessorInput {
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
  readonly verifiedChainIndex: number;
}

interface VerifiedAnchorPredecessor {
  readonly chainIndex: number;
  readonly nextSeed: string;
}

/**
 * Finds the chain's fully verified, forward-exited activity rooted exactly at the chain's current
 * verified anchor — the only shape a missed verified-anchor advance can take, since per-chain FIFO
 * guarantees everything behind the claimed frontier already verified. Undefined when no such
 * activity exists, or its tail checkpoint consumed nothing (the Started-only case), meaning there
 * is nothing to reconcile. The row's own tail checkpoint carries the forward-exit filter, so at
 * most one activity can ever match: the `appendedChainIndex` compare-and-swap admits only one
 * activity to advance the anchor from a given chain position.
 */
export async function findVerifiedAnchorPredecessor(
  trx: Kysely<DB>,
  input: Readonly<FindVerifiedAnchorPredecessorInput>,
): Promise<VerifiedAnchorPredecessor | undefined> {
  const predecessor = await trx
    .selectFrom('activities')
    .innerJoin('activityCheckpoints', (join) =>
      join
        .onRef('activityCheckpoints.activityId', '=', 'activities.id')
        .onRef('activityCheckpoints.version', '=', 'activities.appendedHead'),
    )
    .select('activityCheckpoints.payload')
    .where('activities.avatarId', '=', input.avatarID)
    .where('activities.scopeType', '=', input.scopeType)
    .where('activities.scopeId', '=', input.scopeID)
    .where('activities.startChainIndex', '=', input.verifiedChainIndex)
    .where('activities.status', 'in', ['stopped', 'capped'])
    .where((eb) => eb('activities.verifiedHead', '=', eb.ref('activities.appendedHead')))
    .where('activities.appendedHead', '>', 0)
    .where(sql<boolean>`activity_checkpoints.payload ->> 'type' != 'started'`)
    .executeTakeFirst();

  if (predecessor === undefined) {
    return undefined;
  }

  const payload = CheckpointPayloadSchema.parse(predecessor.payload);

  return { chainIndex: payload.chainIndex, nextSeed: payload.nextSeed };
}
