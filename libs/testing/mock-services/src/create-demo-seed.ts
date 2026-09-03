import { createId } from '@paralleldrive/cuid2';
import { activeAvatarCollection } from './db/active-avatar-collection';
import { avatarCollection } from './db/avatar-collection';
import { userCollection } from './db/user-collection';
import { DEMO_ACCOUNTS } from './demo-accounts';

export async function createDemoSeed(): Promise<void> {
  for (const account of DEMO_ACCOUNTS) {
    const userID = createId();

    await userCollection.create({
      createdAt: new Date(),
      email: account.email,
      id: userID,
      name: account.name,
      password: account.password,
      seed: 0,
      updatedAt: new Date(),
      username: account.username,
    });

    if (account.avatarName !== null) {
      const avatar = await avatarCollection.create({
        createdAt: new Date(),
        id: createId(),
        name: account.avatarName,
        updatedAt: new Date(),
        userID,
      });

      await activeAvatarCollection.create({ avatarID: avatar.id, userID });
    }
  }
}
