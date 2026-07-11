import { randomBytes } from 'node:crypto';
import { createId } from '@paralleldrive/cuid2';
import type { ActivityData, BuildSnapshot } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type {
  ActiveActivityConflictPayload,
  EmptyErrorPayload,
  MissingSessionPayload,
} from '../types';
import { toActivityData } from './to-activity-data';

/**
 * Db handle plus the version stamps every new activity is minted against.
 */
interface StartActivityDeps {
  readonly contentVersion: string;
  readonly db: Kysely<DB>;
  readonly simVersion: string;
}

/**
 * oRPC handler opts for the authed `startActivity` procedure.
 */
interface StartActivityOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly CONFLICT: (payload: ActiveActivityConflictPayload) => Error;
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly avatarID: string; readonly nodeID: string };
}

/**
 * Starts an activity for an avatar owned by the acting user, snapshotting the avatar's current
 * progression as the build the stream plays against. Throws CONFLICT with the avatar's existing
 * activity when one is already active — the partial unique index is the serialization point, this
 * handler just reports what it caught.
 */
export async function startActivity(
  deps: StartActivityDeps,
  opts: StartActivityOpts,
): Promise<ActivityData> {
  const actingUserID = opts.context.actingUserId;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = await deps.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', opts.input.avatarID)
    .where('userId', '=', actingUserID)
    .executeTakeFirst();

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const id = `act_${createId()}`;
  const seed = randomBytes(16).toString('hex');
  const buildSnapshot: BuildSnapshot = { class: avatar.class, level: avatar.level, xp: avatar.xp };

  const startHash = buildStartHash({
    activityID: id,
    contentVersion: deps.contentVersion,
    seed,
    simVersion: deps.simVersion,
  });

  try {
    const row = await deps.db
      .insertInto('activities')
      .values({
        avatarId: opts.input.avatarID,
        buildSnapshot,
        contentVersion: deps.contentVersion,
        id,
        lastHash: startHash,
        nodeId: opts.input.nodeID,
        seed,
        simVersion: deps.simVersion,
        startHash,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toActivityData(row);
  } catch (error: unknown) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const existing = await deps.db
      .selectFrom('activities')
      .selectAll()
      .where('avatarId', '=', opts.input.avatarID)
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();

    throw opts.errors.CONFLICT({ data: { activity: toActivityData(existing) } });
  }
}

/**
 * postgres.js surfaces a unique-constraint violation as SQLSTATE 23505.
 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
