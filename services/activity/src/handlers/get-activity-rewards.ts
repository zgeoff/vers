import type { RewardItemAffix } from '@vers/contract-activity';
import { RewardItemAffixSchema } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';

interface GetActivityRewardsOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly activityID: string; readonly afterChainIndex?: number | undefined };
}

interface RewardItem {
  readonly affixes: Array<RewardItemAffix>;
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

export async function getActivityRewards(
  db: Kysely<DB>,
  opts: GetActivityRewardsOpts,
): Promise<GetActivityRewardsResult> {
  if (opts.context.actingUserID === null) {
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
    .where('avatars.userId', '=', opts.context.actingUserID)
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
        affixes: RewardItemAffixSchema.array().parse(row.affixes),
        baseID: row.baseId,
        contentVersion: row.contentVersion,
        rarityID: row.rarityId,
      },
      ordinal: row.ordinal,
    })),
    verifiedHead: activity.verifiedHead,
  };
}
