import type { DB } from '@vers/db';
import { buildUnsettledXP } from '@vers/idle-core';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { MissingSessionPayload } from '../types';

interface GetAvatarProgressionDeps {
  readonly db: Kysely<DB>;
  readonly sendReplayWake: () => void;
}

interface GetAvatarProgressionOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly avatarID: string };
}

interface PendingXPEntry {
  readonly activityID: string;
  readonly xpDelta: number;
}

interface ActiveXPEntry {
  readonly activityID: string;
  readonly settledXP: number;
}

interface AvatarProgression {
  readonly active: ActiveXPEntry | null;
  readonly level: number;
  readonly pending: Array<PendingXPEntry>;
  readonly xp: number;
}

export async function getAvatarProgression(
  deps: GetAvatarProgressionDeps,
  opts: GetAvatarProgressionOpts,
): Promise<AvatarProgression | null> {
  if (opts.context.actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const rows = await deps.db
    .selectFrom('avatars')
    .leftJoin('activities', (join) =>
      join
        .onRef('activities.avatarId', '=', 'avatars.id')
        .on('activities.status', '!=', 'active')
        .on('activities.status', '!=', 'rejected')
        .onRef('activities.verifiedHead', '<', 'activities.appendedHead'),
    )
    .leftJoin('activityCheckpoints', (join) =>
      join
        .onRef('activityCheckpoints.activityId', '=', 'activities.id')
        .onRef('activityCheckpoints.version', '=', 'activities.appendedHead'),
    )
    .leftJoin('activities as liveActivity', (join) =>
      join
        .onRef('liveActivity.avatarId', '=', 'avatars.id')
        .on('liveActivity.status', '=', 'active'),
    )
    .leftJoinLateral(
      (eb) =>
        eb
          .selectFrom('activityCheckpoints as unverified')
          .select(
            sql<string>`coalesce(sum((unverified.payload -> 'rewards' ->> 'xp')::integer), 0)`.as(
              'deltaSum',
            ),
          )
          .whereRef('unverified.activityId', '=', 'activities.id')
          .whereRef('unverified.version', '>', 'activities.verifiedHead')
          .as('unsettled'),
      (join) => join.onTrue(),
    )
    .select([
      'avatars.level',
      'avatars.xp',
      'activities.id',
      'activities.settledXp',
      'activityCheckpoints.payload',
      'unsettled.deltaSum',
      'liveActivity.id as liveActivityId',
      'liveActivity.settledXp as liveSettledXp',
    ])
    .where('avatars.id', '=', opts.input.avatarID)
    .where('avatars.userId', '=', opts.context.actingUserID)
    .execute();

  const [settled] = rows;

  if (settled === undefined) {
    return null;
  }

  const pending = rows.flatMap((row) => findPendingEntry(row));

  if (pending.length > 0) {
    deps.sendReplayWake();
  }

  const active =
    settled.liveActivityId === null
      ? null
      : { activityID: settled.liveActivityId, settledXP: settled.liveSettledXp ?? 0 };

  return { active, level: settled.level, pending, xp: settled.xp };
}

interface PendingCandidateRow {
  readonly deltaSum: null | string;
  readonly id: null | string;
  readonly payload: unknown;
  readonly settledXp: null | number;
}

function findPendingEntry(row: Readonly<PendingCandidateRow>): Array<PendingXPEntry> {
  if (row.id === null) {
    return [];
  }

  const xpDelta = buildUnsettledXP({
    settledXP: row.settledXp ?? 0,
    tailPayload: row.payload,
    unverifiedDeltaSum: Number(row.deltaSum ?? 0),
  });

  if (xpDelta === 0) {
    return [];
  }

  return [{ activityID: row.id, xpDelta }];
}
