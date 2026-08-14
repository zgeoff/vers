import { randomInt } from 'node:crypto';
import { createId } from '@paralleldrive/cuid2';
import { findLiveActivityAvatar, upsertActiveAvatar } from '@vers/active-avatar';
import type { AvatarData, AvatarMode } from '@vers/contract-avatar';
import { AVATAR_MODE_CAP } from '@vers/contract-avatar';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';
import { toAvatarData } from './to-avatar-data';

/**
 * Payload shape for createAvatar's LIMIT_REACHED: the mode whose cap the caller hit.
 */
interface LimitReachedPayload {
  readonly data: { readonly cap: number; readonly mode: AvatarMode };
}

/**
 * oRPC handler opts for the authed `createAvatar` procedure.
 */
interface CreateAvatarOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly CONFLICT: (payload: EmptyErrorPayload) => Error;
    readonly LIMIT_REACHED: (payload: LimitReachedPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly mode: AvatarMode; readonly name: string };
}

/**
 * Creates an avatar owned by the acting user and makes it the active one, unless a live activity
 * holds the selection — then the new avatar lands unselected, since taking the slot would steal
 * it from the running avatar. Throws CONFLICT when the name is already taken and LIMIT_REACHED at
 * the per-mode cap. Runs inside the caller's transaction when given one, or opens its own
 * otherwise.
 */
export async function createAvatar(db: Kysely<DB>, opts: CreateAvatarOpts): Promise<AvatarData> {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  try {
    return db.isTransaction
      ? await runCreateWrites(db, actingUserId, opts)
      : await db.transaction().execute((trx) => runCreateWrites(trx, actingUserId, opts));
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      throw opts.errors.CONFLICT({ data: {} });
    }

    throw error;
  }
}

async function runCreateWrites(
  trx: Kysely<DB>,
  actingUserId: string,
  opts: CreateAvatarOpts,
): Promise<AvatarData> {
  // the per-user advisory lock serializes the count against concurrent creates; a row lock can't
  // apply to inserts that don't exist yet
  await sql`select pg_advisory_xact_lock(hashtext(${actingUserId}))`.execute(trx);

  const counted = await trx
    .selectFrom('avatars')
    .select((eb) => eb.fn.countAll<number>().as('held'))
    .where('userId', '=', actingUserId)
    .where('mode', '=', opts.input.mode)
    .executeTakeFirstOrThrow();

  if (counted.held >= AVATAR_MODE_CAP) {
    throw opts.errors.LIMIT_REACHED({
      data: { cap: AVATAR_MODE_CAP, mode: opts.input.mode },
    });
  }

  const row = await trx
    .insertInto('avatars')
    .values({
      id: createId(),
      mode: opts.input.mode,
      name: opts.input.name,
      seed: randomInt(0, 2 ** 31),
      userId: actingUserId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  if ((await findLiveActivityAvatar(trx, actingUserId)) === null) {
    await upsertActiveAvatar(trx, actingUserId, row.id);
  }

  return toAvatarData(row);
}

/**
 * postgres.js surfaces a unique-constraint violation as SQLSTATE 23505.
 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
