import { createDB } from '@vers/db';
import { DEMO_ACCOUNTS } from '@vers/mock-services';
import invariant from 'tiny-invariant';

/**
 * Seeds the full-stack postgres with the shared demo accounts so a spec's seeded login lands the
 * same as it does against the mock backend. Passwords are argon2id-hashed to match the user
 * service's own hasher; each account's avatar is a direct row insert, enough for the shell's
 * active-avatar gate. Run once against the migrated stack database before playwright.
 */
async function createStackSeed(): Promise<void> {
  const databaseURL = process.env['DATABASE_URL'];

  invariant(databaseURL !== undefined, 'DATABASE_URL must be set to seed the stack database');

  const db = createDB({ databaseURL });

  try {
    for (const account of DEMO_ACCOUNTS) {
      const passwordHash = await Bun.password.hash(account.password, 'argon2id');

      const user = await db
        .insertInto('users')
        .values({
          email: account.email,
          id: crypto.randomUUID(),
          name: account.name,
          passwordHash,
          username: account.username,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      if (account.avatarName !== null) {
        const avatar = await db
          .insertInto('avatars')
          .values({ id: crypto.randomUUID(), name: account.avatarName, userId: user.id })
          .returning('id')
          .executeTakeFirstOrThrow();

        await db
          .insertInto('activeAvatars')
          .values({ avatarId: avatar.id, userId: user.id })
          .execute();
      }
    }
  } finally {
    await db.destroy();
  }
}

await createStackSeed();
