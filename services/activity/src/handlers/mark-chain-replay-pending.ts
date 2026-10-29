import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

interface MarkChainReplayPendingChain {
  readonly avatarId: string;
  readonly scopeId: string;
  readonly scopeType: string;
}

export async function markChainReplayPending(
  trx: Kysely<DB>,
  chain: Readonly<MarkChainReplayPendingChain>,
): Promise<void> {
  // a set flag fails the filter without a row lock, so the common append never queues behind the
  // verifier, which holds this row for the whole of a replay
  await trx
    .updateTable('activityChains')
    .set({ replayPending: true })
    .where('avatarId', '=', chain.avatarId)
    .where('scopeType', '=', chain.scopeType)
    .where('scopeId', '=', chain.scopeId)
    .where('replayPending', '=', false)
    .execute();
}
