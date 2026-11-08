import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

interface ChainKey {
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

interface ChainAnchors {
  readonly appendedChainIndex: number;
  readonly appendedNextSeed: string;
  readonly verifiedChainIndex: number;
  readonly verifiedNextSeed: string;
}

export async function readChainAnchors(
  db: Kysely<DB>,
  chain: Readonly<ChainKey>,
): Promise<ChainAnchors | null> {
  const row = await db
    .selectFrom('activityChains')
    .select(['appendedChainIndex', 'appendedNextSeed', 'verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', chain.avatarID)
    .where('scopeType', '=', chain.scopeType)
    .where('scopeId', '=', chain.scopeID)
    .executeTakeFirst();

  return row ?? null;
}
