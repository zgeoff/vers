import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { SettlementSnapshot } from './types';

export async function readSettlementSnapshot(
  db: Kysely<DB>,
  avatarID: string,
): Promise<SettlementSnapshot> {
  const activities = await db
    .selectFrom('activities')
    .select(['appendedHead', 'id', 'settledXp', 'status', 'verifiedHead', 'writerSessionId'])
    .where('avatarId', '=', avatarID)
    .execute();

  const chains = await db
    .selectFrom('activityChains')
    .select(['appendedChainIndex', 'scopeId', 'verifiedChainIndex'])
    .where('avatarId', '=', avatarID)
    .execute();

  const avatar = await db
    .selectFrom('avatars')
    .select('xp')
    .where('id', '=', avatarID)
    .executeTakeFirstOrThrow();

  const grants = await db
    .selectFrom('avatarGrants')
    .select('key')
    .where('avatarId', '=', avatarID)
    .where('kind', '=', 'first_clear')
    .execute();

  const items = await db
    .selectFrom('avatarItems')
    .select(['chainIndex', 'ordinal', 'scopeId'])
    .where('avatarId', '=', avatarID)
    .execute();

  return {
    activities: activities
      .map((activity) => ({
        appendedHead: activity.appendedHead,
        id: activity.id,
        settledXP: activity.settledXp,
        status: activity.status,
        verifiedHead: activity.verifiedHead,
        writer: activity.writerSessionId,
      }))
      .toSorted((left, right) => left.id.localeCompare(right.id)),
    avatarXP: avatar.xp,
    chains: chains
      .map((chain) => ({
        appendedChainIndex: chain.appendedChainIndex,
        scopeID: chain.scopeId,
        verifiedChainIndex: chain.verifiedChainIndex,
      }))
      .toSorted((left, right) => left.scopeID.localeCompare(right.scopeID)),
    grants: grants.map((grant) => grant.key).toSorted(),
    items: items.map((item) => `${item.scopeId}:${item.chainIndex}:${item.ordinal}`).toSorted(),
  };
}
