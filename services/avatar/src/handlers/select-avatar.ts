import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';
import { findLiveActivityAvatar } from './find-live-activity-avatar';

/**
 * Payload shape for selectAvatar's CONFLICT: the live run's avatar, named so the client can tell
 * the player who holds the active slot.
 */
interface ActivityLockedPayload {
  readonly data: { readonly owningAvatarID: string; readonly owningAvatarName: string };
}

/**
 * oRPC handler opts for the authed `selectAvatar` procedure.
 */
interface SelectAvatarOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly CONFLICT: (payload: ActivityLockedPayload) => Error;
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly id: string };
}

/**
 * Persists the caller's active avatar. A live activity locks the selection to the avatar running
 * it: selecting any other avatar throws CONFLICT naming the run's owner, while re-selecting the
 * owner (or the already-active avatar) is a no-op success. The per-user advisory lock serializes
 * this against concurrent creates; the live-activity read is best-effort against a run starting
 * concurrently until activity starts are gated to the active avatar. Runs inside the caller's
 * transaction when given one, or opens its own otherwise.
 */
export function selectAvatar(
  db: Kysely<DB>,
  opts: SelectAvatarOpts,
): Promise<{ activeAvatarID: string }> {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  return db.isTransaction
    ? runSelectWrites(db, actingUserId, opts)
    : db.transaction().execute((trx) => runSelectWrites(trx, actingUserId, opts));
}

async function runSelectWrites(
  trx: Kysely<DB>,
  actingUserId: string,
  opts: SelectAvatarOpts,
): Promise<{ activeAvatarID: string }> {
  await sql`select pg_advisory_xact_lock(hashtext(${actingUserId}))`.execute(trx);

  const avatar = await trx
    .selectFrom('avatars')
    .select(['id'])
    .where('id', '=', opts.input.id)
    .where('userId', '=', actingUserId)
    .executeTakeFirst();

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const liveAvatar = await findLiveActivityAvatar(trx, actingUserId);

  if (liveAvatar !== null && liveAvatar.id !== avatar.id) {
    throw opts.errors.CONFLICT({
      data: { owningAvatarID: liveAvatar.id, owningAvatarName: liveAvatar.name },
    });
  }

  await trx
    .insertInto('activeAvatars')
    .values({ avatarId: avatar.id, userId: actingUserId })
    .onConflict((oc) =>
      oc.column('userId').doUpdateSet({ avatarId: avatar.id, updatedAt: sql`now()` }),
    )
    .execute();

  return { activeAvatarID: avatar.id };
}
