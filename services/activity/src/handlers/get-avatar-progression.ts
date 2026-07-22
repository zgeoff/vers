import type { DB } from '@vers/db';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { buildUnsettledXP } from '../build-unsettled-xp';
import type { MissingSessionPayload } from '../types';

interface GetAvatarProgressionDeps {
  readonly db: Kysely<DB>;
  readonly sendReplayWake: () => void;
}

/**
 * oRPC handler opts for the authed `getAvatarProgression` procedure.
 */
interface GetAvatarProgressionOpts {
  readonly context: { readonly actingUserId: null | string };
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

/**
 * Returns an avatar's settled xp/level plus one pending entry per ended-but-unsettled activity —
 * a stopped, capped, quarantined, or parked activity whose verified cursor hasn't caught up to its
 * appended tail — and, while a run is live, how much of that run's xp the settled total already
 * carries, so a client overlaying the run's own running total never counts the settled part twice.
 * All three are read in one statement, so a single read always sees the same constant sum a
 * verifier apply moves a delta across: settlement never visibly jumps. A non-empty pending set
 * pokes the replay service, so a client polling this while showing "Settling…" is itself the retry
 * trigger for a poke a crash or deploy lost. Returns null when the avatar doesn't exist or isn't
 * owned by the acting user.
 */
export async function getAvatarProgression(
  deps: GetAvatarProgressionDeps,
  opts: GetAvatarProgressionOpts,
): Promise<AvatarProgression | null> {
  if (opts.context.actingUserId === null) {
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
            sql<number>`coalesce(sum((unverified.payload -> 'rewards' ->> 'xp')::integer), 0)::integer`.as(
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
    .where('avatars.userId', '=', opts.context.actingUserId)
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
  readonly deltaSum: null | number;
  readonly id: null | string;
  readonly payload: unknown;
  readonly settledXp: null | number;
}

/**
 * Builds a pending entry from a candidate row, or nothing when the row carries no pending activity
 * — a null activity id from the left join, or an activity whose unsettled xp comes to nothing.
 */
function findPendingEntry(row: Readonly<PendingCandidateRow>): Array<PendingXPEntry> {
  if (row.id === null) {
    return [];
  }

  const xpDelta = buildUnsettledXP({
    settledXP: row.settledXp ?? 0,
    tailPayload: row.payload,
    unverifiedDeltaSum: row.deltaSum ?? 0,
  });

  if (xpDelta === 0) {
    return [];
  }

  return [{ activityID: row.id, xpDelta }];
}
