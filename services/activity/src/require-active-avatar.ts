import { findActiveAvatar, findLiveActivityAvatar, upsertActiveAvatar } from '@vers/active-avatar';
import type { DB } from '@vers/db';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import { recordAvatarNotActiveRejection } from './metrics/record-avatar-not-active-rejection';
import type { AvatarNotActivePayload } from './types';

/**
 * Errors thrown when the account's active avatar doesn't match the requested one.
 */
interface RequireActiveAvatarErrors {
  readonly AVATAR_NOT_ACTIVE: (payload: AvatarNotActivePayload) => Error;
}

/**
 * Throws AVATAR_NOT_ACTIVE unless `avatarID` is the account's active avatar, naming whichever
 * avatar actually is. An account with no selection row — predating the active-avatar migration, or
 * left without one because its prior selection's avatar was deleted — adopts `avatarID` as active,
 * unless a different avatar already holds a live run; adopting past a live run would mint a second
 * one for the account, so that start is refused and the live run's avatar named instead. Takes
 * the same per-user advisory lock the avatar service's select and create take, so the read and the
 * adopt-or-refuse it decides on are atomic against a concurrent selection change, avatar creation,
 * or another activity start for the same user.
 */
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
