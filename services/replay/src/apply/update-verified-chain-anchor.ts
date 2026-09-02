import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

interface UpdateVerifiedChainAnchorInput {
  readonly avatarID: string;
  readonly chainIndex: number;
  readonly nextSeed: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

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
