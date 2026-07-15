import { CheckpointPayloadSchema } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { isForwardExited } from '../replay/is-forward-exited';

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
 * is nothing to reconcile.
 */
export async function findVerifiedAnchorPredecessor(
  trx: Kysely<DB>,
  input: Readonly<FindVerifiedAnchorPredecessorInput>,
): Promise<VerifiedAnchorPredecessor | undefined> {
  const predecessor = await trx
    .selectFrom('activities')
    .select(['appendedHead', 'id', 'status'])
    .where('avatarId', '=', input.avatarID)
    .where('scopeType', '=', input.scopeType)
    .where('scopeId', '=', input.scopeID)
    .where('startChainIndex', '=', input.verifiedChainIndex)
    .where('status', 'in', ['stopped', 'capped'])
    .where((eb) => eb('verifiedHead', '=', eb.ref('appendedHead')))
    .where('appendedHead', '>', 0)
    .executeTakeFirst();

  if (predecessor === undefined) {
    return undefined;
  }

  const tail = await trx
    .selectFrom('activityCheckpoints')
    .select('payload')
    .where('activityId', '=', predecessor.id)
    .where('version', '=', predecessor.appendedHead)
    .executeTakeFirst();

  if (tail === undefined) {
    return undefined;
  }

  const payload = CheckpointPayloadSchema.parse(tail.payload);

  if (!isForwardExited(payload.type, predecessor.status)) {
    return undefined;
  }

  return { chainIndex: payload.chainIndex, nextSeed: payload.nextSeed };
}
