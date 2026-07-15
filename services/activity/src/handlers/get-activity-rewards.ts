import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';

/**
 * oRPC handler opts for the authed `getActivityRewards` procedure.
 */
interface GetActivityRewardsOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly activityID: string; readonly afterChainIndex?: number | undefined };
}

interface RewardItem {
  readonly affixes: Array<{
    readonly affixID: string;
    readonly groupID: string;
    readonly value: number;
  }>;
  readonly baseID: string;
  readonly contentVersion: string;
  readonly rarityID: string;
}

interface GetActivityRewardsResult {
  readonly items: Array<{
    readonly chainIndex: number;
    readonly item: RewardItem;
    readonly ordinal: number;
  }>;
  readonly verifiedHead: number;
}

/**
 * Returns an activity's revealed reward-slot contents: `avatar_items` rows minted at settlement for
 * coordinates at or below the activity's verified anchor, ordered by chain position then slot
 * ordinal. Mint and anchor-advance commit in the same transaction, so every coordinate this range
 * covers is already minted — an unverified tail simply isn't in range yet, never a partial read.
 * `afterChainIndex` is a keyset cursor: a client that already holds rows through some chain index
 * passes it to read only what advanced since, never refetching the full history.
 */
export async function getActivityRewards(
  db: Kysely<DB>,
  opts: GetActivityRewardsOpts,
): Promise<GetActivityRewardsResult> {
  if (opts.context.actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const activity = await db
    .selectFrom('activities')
    .innerJoin('avatars', 'avatars.id', 'activities.avatarId')
    .select([
      'activities.avatarId',
      'activities.scopeId',
      'activities.scopeType',
      'activities.startChainIndex',
      'activities.verifiedHead',
    ])
    .where('activities.id', '=', opts.input.activityID)
    .where('avatars.userId', '=', opts.context.actingUserId)
    .executeTakeFirst();

  if (activity === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const minChainIndex = Math.max(activity.startChainIndex, opts.input.afterChainIndex ?? -1);

  const rows = await db
    .selectFrom('avatarItems')
    .select(['affixes', 'baseId', 'chainIndex', 'contentVersion', 'ordinal', 'rarityId'])
    .where('avatarId', '=', activity.avatarId)
    .where('scopeType', '=', activity.scopeType)
    .where('scopeId', '=', activity.scopeId)
    .where('chainIndex', '>', minChainIndex)
    .where('chainIndex', '<=', activity.startChainIndex + activity.verifiedHead)
    .orderBy('chainIndex', 'asc')
    .orderBy('ordinal', 'asc')
    .execute();

  return {
    items: rows.map((row) => ({
      chainIndex: row.chainIndex,
      item: {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; every write is this service's own mint construction, and oRPC's output validation rejects a drifted shape at the boundary
        affixes: row.affixes as RewardItem['affixes'],
        baseID: row.baseId,
        contentVersion: row.contentVersion,
        rarityID: row.rarityId,
      },
      ordinal: row.ordinal,
    })),
    verifiedHead: activity.verifiedHead,
  };
}
