import { findActiveAvatar, findLiveActivityAvatar, upsertActiveAvatar } from '@vers/active-avatar';
import type { DB } from '@vers/db';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { recordAvatarNotActiveRejection } from './metrics/record-avatar-not-active-rejection';
import type { AvatarNotActivePayload } from './types';

interface RequireActiveAvatarErrors {
  readonly AVATAR_NOT_ACTIVE: (payload: AvatarNotActivePayload) => Error;
}

export async function requireActiveAvatar(
  trx: Kysely<DB>,
  userID: string,
  avatarID: string,
  errors: RequireActiveAvatarErrors,
): Promise<void> {
  await sql`select pg_advisory_xact_lock(hashtext(${userID}))`.execute(trx);

  const selection = await findActiveAvatar(trx, userID);

  if (selection === undefined) {
    const liveAvatar = await findLiveActivityAvatar(trx, userID);

    if (liveAvatar !== null && liveAvatar.id !== avatarID) {
      recordAvatarNotActiveRejection();

      throw errors.AVATAR_NOT_ACTIVE({
        data: { activeAvatarID: liveAvatar.id, activeAvatarName: liveAvatar.name },
      });
    }

    await upsertActiveAvatar(trx, userID, avatarID);

    return;
  }

  if (selection.id !== avatarID) {
    recordAvatarNotActiveRejection();

    throw errors.AVATAR_NOT_ACTIVE({
      data: { activeAvatarID: selection.id, activeAvatarName: selection.name },
    });
  }
}
