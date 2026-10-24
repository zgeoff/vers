import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { RestoreDrillCheck } from './types';

export async function readChainAnchorChecks(
  db: Kysely<DB>,
): Promise<ReadonlyArray<RestoreDrillCheck>> {
  const [chainsVerifiedPastAppended, activeActivitiesOffAnchor, activitiesWithoutChain] =
    await Promise.all([
      db
        .selectFrom('activityChains')
        .select(['avatarId', 'scopeId', 'scopeType'])
        .whereRef('verifiedChainIndex', '>', 'appendedChainIndex')
        .orderBy('avatarId')
        .orderBy('scopeType')
        .orderBy('scopeId')
        .execute(),
      db
        .selectFrom('activities')
        .innerJoin('activityChains as chain', (join) =>
          join
            .onRef('chain.avatarId', '=', 'activities.avatarId')
            .onRef('chain.scopeType', '=', 'activities.scopeType')
            .onRef('chain.scopeId', '=', 'activities.scopeId'),
        )
        .select('activities.id')
        .where('activities.status', '=', 'active')
        .whereRef('activities.startChainIndex', '!=', 'chain.appendedChainIndex')
        .orderBy('activities.id')
        .execute(),
      db
        .selectFrom('activities')
        .leftJoin('activityChains as chain', (join) =>
          join
            .onRef('chain.avatarId', '=', 'activities.avatarId')
            .onRef('chain.scopeType', '=', 'activities.scopeType')
            .onRef('chain.scopeId', '=', 'activities.scopeId'),
        )
        .select('activities.id')
        .where('chain.avatarId', 'is', null)
        .orderBy('activities.id')
        .execute(),
    ]);

  return [
    {
      area: 'chain-anchors',
      name: 'the verified anchor sits at or behind the appended anchor',
      violations: chainsVerifiedPastAppended.map(
        (row) => `chain ${row.avatarId}/${row.scopeType}/${row.scopeId}`,
      ),
    },
    {
      area: 'chain-anchors',
      name: 'an active activity starts at its chain’s appended anchor',
      violations: activeActivitiesOffAnchor.map((row) => `activity ${row.id}`),
    },
    {
      area: 'chain-anchors',
      name: 'every activity has its chain',
      violations: activitiesWithoutChain.map((row) => `activity ${row.id}`),
    },
  ];
}
