import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { RestoreDrillCheck } from './types';

export async function readItemIdentityChecks(
  db: Kysely<DB>,
): Promise<ReadonlyArray<RestoreDrillCheck>> {
  const [itemsOffVerifiedPositions, overlappingActivities, itemsWithoutContent] = await Promise.all(
    [
      db
        .selectFrom('avatarItems as item')
        .select([
          'item.avatarId',
          'item.scopeType',
          'item.scopeId',
          'item.chainIndex',
          'item.ordinal',
        ])
        .where((eb) => {
          const verifyingActivity = eb
            .selectFrom('activities')
            .select('activities.id')
            .whereRef('activities.avatarId', '=', 'item.avatarId')
            .whereRef('activities.scopeType', '=', 'item.scopeType')
            .whereRef('activities.scopeId', '=', 'item.scopeId')
            .whereRef('activities.startChainIndex', '<', 'item.chainIndex')
            .where((inner) => {
              const verifiedEnd = inner(
                'activities.startChainIndex',
                '+',
                inner.ref('activities.verifiedHead'),
              );

              return inner(verifiedEnd, '>=', inner.ref('item.chainIndex'));
            });

          return eb.not(eb.exists(verifyingActivity));
        })
        .orderBy('item.avatarId')
        .orderBy('item.scopeType')
        .orderBy('item.scopeId')
        .orderBy('item.chainIndex')
        .orderBy('item.ordinal')
        .execute(),
      db
        .selectFrom('activities as earlier')
        .innerJoin('activities as later', (join) =>
          join
            .onRef('later.avatarId', '=', 'earlier.avatarId')
            .onRef('later.scopeType', '=', 'earlier.scopeType')
            .onRef('later.scopeId', '=', 'earlier.scopeId')
            .onRef('later.id', '!=', 'earlier.id'),
        )
        .select(['earlier.id as earlier', 'later.id as later'])
        .where((eb) => {
          const startsFurther = eb('later.startChainIndex', '>', eb.ref('earlier.startChainIndex'));

          const startsAtSameIndex = eb(
            'later.startChainIndex',
            '=',
            eb.ref('earlier.startChainIndex'),
          );

          const laterStart = eb.refTuple('later.startedAt', 'later.id');
          const earlierStart = eb.refTuple('earlier.startedAt', 'earlier.id');
          const startedAfter = eb(laterStart, '>', earlierStart);

          return eb.or([startsFurther, eb.and([startsAtSameIndex, startedAfter])]);
        })
        .where('earlier.status', 'in', ['active', 'capped', 'stopped'])
        .where('later.status', 'in', ['active', 'capped', 'stopped'])

        // the `Started` checkpoint draws nothing, so an activity that appended only it leaves the
        // anchor where it was and its successor starts at the same index
        .where('earlier.appendedHead', '>', 1)
        .where((eb) => {
          const appendedEnd = eb('earlier.startChainIndex', '+', eb.ref('earlier.appendedHead'));

          return eb(appendedEnd, '>', eb.ref('later.startChainIndex'));
        })
        .orderBy('earlier.id')
        .orderBy('later.id')
        .execute(),
      db
        .selectFrom('avatarItems as item')
        .leftJoin('contentVersions as content', 'content.contentVersion', 'item.contentVersion')
        .select([
          'item.avatarId',
          'item.scopeType',
          'item.scopeId',
          'item.chainIndex',
          'item.ordinal',
        ])
        .where('content.contentVersion', 'is', null)
        .orderBy('item.avatarId')
        .orderBy('item.scopeType')
        .orderBy('item.scopeId')
        .orderBy('item.chainIndex')
        .orderBy('item.ordinal')
        .execute(),
    ],
  );

  return [
    {
      area: 'item-identities',
      name: 'every item sits at a verified chain position',
      violations: itemsOffVerifiedPositions.map((item) => formatItemKey(item)),
    },
    {
      area: 'item-identities',
      name: 'no two live activities claim one chain position',
      violations: overlappingActivities.map((row) => `activities ${row.earlier} and ${row.later}`),
    },
    {
      area: 'item-identities',
      name: 'every item’s content version is published',
      violations: itemsWithoutContent.map((item) => formatItemKey(item)),
    },
  ];
}

interface ItemKey {
  readonly avatarId: string;
  readonly chainIndex: number;
  readonly ordinal: number;
  readonly scopeId: string;
  readonly scopeType: string;
}

function formatItemKey(item: Readonly<ItemKey>): string {
  return `item ${item.avatarId}/${item.scopeType}/${item.scopeId}#${item.chainIndex}.${item.ordinal}`;
}
