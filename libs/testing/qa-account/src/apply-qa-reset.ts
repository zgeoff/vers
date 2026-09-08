import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import { QA_DOMAIN } from './parse-qa-user';
import type { QAUser } from './types';

export interface ApplyQAResetInput {
  readonly all: boolean;
  readonly user: QAUser;
}

export interface QAResetResult {
  readonly activities: number;
  readonly avatars: number;
  readonly removedAccount: boolean;
}

export async function applyQAReset(
  db: Kysely<DB>,
  input: Readonly<ApplyQAResetInput>,
): Promise<QAResetResult> {
  const user = await db
    .selectFrom('users')
    .select(['email', 'id'])
    .where('email', '=', input.user.email)
    .executeTakeFirst();

  if (user === undefined) {
    throw new Error(`no account exists for ${input.user.email}`);
  }

  invariant(user.email.endsWith(`@${QA_DOMAIN}`), 'a reset only ever touches a QA account');

  return db.transaction().execute(async (trx) => {
    const avatars = await trx
      .selectFrom('avatars')
      .select('id')
      .where('userId', '=', user.id)
      .execute();

    const avatarIDs = avatars.map((avatar) => avatar.id);
    let activities = 0;

    if (avatarIDs.length > 0) {
      const deleted = await trx
        .deleteFrom('activities')
        .where('avatarId', 'in', avatarIDs)
        .executeTakeFirst();

      activities = Number(deleted.numDeletedRows);
    }

    if (input.all) {
      // the users row cascades to avatars, chains, items, grants, and sessions; verifications and
      // step-up transactions key on the user id or email without a foreign key, so they go by hand
      await trx.deleteFrom('verifications').where('target', 'in', [user.id, user.email]).execute();

      await trx
        .deleteFrom('pendingTransactions')
        .where('target', 'in', [user.id, user.email])
        .execute();

      await trx.deleteFrom('users').where('id', '=', user.id).execute();

      return { activities, avatars: avatarIDs.length, removedAccount: true };
    }

    if (avatarIDs.length > 0) {
      await trx.deleteFrom('activityChains').where('avatarId', 'in', avatarIDs).execute();
      await trx.deleteFrom('avatarItems').where('avatarId', 'in', avatarIDs).execute();
      await trx.deleteFrom('avatarGrants').where('avatarId', 'in', avatarIDs).execute();

      await trx
        .updateTable('avatars')
        .set({ level: 1, xp: 0 })
        .where('id', 'in', avatarIDs)
        .execute();
    }

    return { activities, avatars: avatarIDs.length, removedAccount: false };
  });
}
