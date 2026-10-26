import { createId } from '@paralleldrive/cuid2';
import type { DB } from '@vers/db';
import { buildLevelFromXP, buildXPThreshold } from '@vers/idle-core';
import type { Kysely } from 'kysely';
import type { LoadPlayerAccount, PlayerProfile } from './types';

// writes the accounts straight to the database, as the e2e stack seed does: sign-up is not on the
// pipeline under load, and a seeded level stands in for an avatar that played before the run
export async function writePlayerAccounts(
  db: Kysely<DB>,
  profiles: ReadonlyArray<PlayerProfile>,
  runID: string,
): Promise<Array<LoadPlayerAccount>> {
  const accounts = profiles.map((profile) => ({
    avatarID: createId(),
    profile,
    userID: createId(),
  }));

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('users')
      .values(
        accounts.map((account) => ({
          email: `load-${runID}-${account.profile.index}@load.invalid`,
          id: account.userID,
          name: `Load ${account.profile.index}`,
          passwordHash: null,
          username: `load_${runID}_${account.profile.index}`,
        })),
      )
      .execute();

    await trx
      .insertInto('avatars')
      .values(
        accounts.map((account) => {
          const xp = buildXPThreshold(account.profile.level);

          return {
            id: account.avatarID,
            level: buildLevelFromXP(xp),
            name: `load${runID}${account.profile.index}`,
            seed: account.profile.index,
            userId: account.userID,
            xp,
          };
        }),
      )
      .execute();

    await trx
      .insertInto('activeAvatars')
      .values(accounts.map((account) => ({ avatarId: account.avatarID, userId: account.userID })))
      .execute();
  });

  return accounts;
}
