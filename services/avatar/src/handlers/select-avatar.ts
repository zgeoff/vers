import { findLiveActivityAvatar, upsertActiveAvatar } from '@vers/active-avatar';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';

interface ActivityLockedPayload {
  readonly data: { readonly owningAvatarID: string; readonly owningAvatarName: string };
}

interface SelectAvatarOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly CONFLICT: (payload: ActivityLockedPayload) => Error;
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly id: string };
}

export function selectAvatar(
  db: Kysely<DB>,
  opts: SelectAvatarOpts,
): Promise<{ activeAvatarID: string }> {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  return db.isTransaction
    ? runSelectWrites(db, actingUserID, opts)
    : db.transaction().execute((trx) => runSelectWrites(trx, actingUserID, opts));
}

async function runSelectWrites(
  trx: Kysely<DB>,
  actingUserID: string,
  opts: SelectAvatarOpts,
): Promise<{ activeAvatarID: string }> {
  await sql`select pg_advisory_xact_lock(hashtext(${actingUserID}))`.execute(trx);

  const avatar = await trx
    .selectFrom('avatars')
    .select(['id'])
    .where('id', '=', opts.input.id)
    .where('userId', '=', actingUserID)
    .executeTakeFirst();

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const liveAvatar = await findLiveActivityAvatar(trx, actingUserID);

  if (liveAvatar !== null && liveAvatar.id !== avatar.id) {
    throw opts.errors.CONFLICT({
      data: { owningAvatarID: liveAvatar.id, owningAvatarName: liveAvatar.name },
    });
  }

  await upsertActiveAvatar(trx, actingUserID, avatar.id);

  return { activeAvatarID: avatar.id };
}
