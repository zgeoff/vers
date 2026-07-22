import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { parseTerminalCheckpointXP } from '../parse-terminal-checkpoint-xp';
import type { MissingSessionPayload } from '../types';
import { sendReplayWake } from '../wake/send-replay-wake';

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

interface AvatarProgression {
  readonly level: number;
  readonly pending: Array<PendingXPEntry>;
  readonly xp: number;
}

/**
 * Returns an avatar's settled xp/level plus one pending entry per terminal-but-unsettled activity
 * — a stopped, capped, quarantined, or parked activity whose verified anchor hasn't caught up to
 * its appended tail. The settled row and the pending set are read in one statement, so a single
 * read always sees the same constant sum a verifier apply moves a delta across: settlement never
 * visibly jumps. A non-empty pending set pokes the replay service, so a client polling this while
 * showing "Settling…" is itself the retry trigger for a poke a crash or deploy lost. Returns null
 * when the avatar doesn't exist or isn't owned by the acting user.
 */
export async function getAvatarProgression(
  db: Kysely<DB>,
  opts: GetAvatarProgressionOpts,
): Promise<AvatarProgression | null> {
  if (opts.context.actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const rows = await db
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
    .select(['avatars.level', 'avatars.xp', 'activities.id', 'activityCheckpoints.payload'])
    .where('avatars.id', '=', opts.input.avatarID)
    .where('avatars.userId', '=', opts.context.actingUserId)
    .execute();

  const [settled] = rows;

  if (settled === undefined) {
    return null;
  }

  const pending = rows.flatMap((row) => findPendingEntry(row));

  if (pending.length > 0) {
    sendReplayWake();
  }

  return { level: settled.level, pending, xp: settled.xp };
}

interface PendingCandidateRow {
  readonly id: null | string;
  readonly payload: unknown;
}

/**
 * Builds a pending entry from a candidate row, or nothing when the row carries no pending activity
 * — a null activity id from the left join, a checkpoint that failed to append past `verifiedHead`
 * at all, or a checkpoint whose payload doesn't parse or isn't a terminal type.
 */
function findPendingEntry(row: Readonly<PendingCandidateRow>): Array<PendingXPEntry> {
  if (row.id === null) {
    return [];
  }

  const xpDelta = parseTerminalCheckpointXP(row.payload);

  if (xpDelta === undefined) {
    return [];
  }

  return [{ activityID: row.id, xpDelta }];
}
