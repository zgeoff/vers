import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

interface UpdateVerifiedChainAnchorInput {
  readonly avatarID: string;
  readonly chainIndex: number;
  readonly nextSeed: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

/**
 * Advances a chain row's verified anchor to `chainIndex`/`nextSeed` in a single statement, guarded
 * forward-only by a compare-and-swap on the chain's own `verifiedChainIndex` — a stale or duplicate
 * call moves nothing.
 */
export async function updateVerifiedChainAnchor(
  trx: Kysely<DB>,
  input: Readonly<UpdateVerifiedChainAnchorInput>,
): Promise<void> {
  await trx
    .updateTable('activityChains')
    .set({ verifiedChainIndex: input.chainIndex, verifiedNextSeed: input.nextSeed })
    .where('avatarId', '=', input.avatarID)
    .where('scopeType', '=', input.scopeType)
    .where('scopeId', '=', input.scopeID)
    .where('verifiedChainIndex', '<', input.chainIndex)
    .execute();
}
