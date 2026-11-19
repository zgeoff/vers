import { randomInt } from 'node:crypto';
import { createDB } from '@vers/db';
import { DEMO_ACCOUNTS } from '@vers/mock-services';
import invariant from 'tiny-invariant';

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
          .values({
            id: crypto.randomUUID(),
            name: account.avatarName,
            seed: randomInt(0, 2 ** 31),
            userId: user.id,
          })
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
