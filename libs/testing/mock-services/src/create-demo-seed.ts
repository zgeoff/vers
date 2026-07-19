import { createId } from '@paralleldrive/cuid2';
import { avatarCollection } from './db/avatar-collection';
import { userCollection } from './db/user-collection';
import { DEMO_ACCOUNTS } from './demo-accounts';

/**
 * Seeds the demo accounts into the mock store with no pre-existing session: every signed-in spec
 * establishes its own session through a real login round trip. Each account carrying an avatar
 * name gets one avatar so the shell's active-avatar gate admits it straight to the game.
 */
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
      await avatarCollection.create({
        createdAt: new Date(),
        id: createId(),
        name: account.avatarName,
        updatedAt: new Date(),
        userID,
      });
    }
  }
}
