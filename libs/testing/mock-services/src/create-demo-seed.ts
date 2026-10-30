import { createId } from '@paralleldrive/cuid2';
import { activeAvatarCollection } from './db/active-avatar-collection';
import { avatarCollection } from './db/avatar-collection';
import {
  MOCK_CURRENT_CONTENT_VERSION,
  contentDocumentCollection,
} from './db/content-document-collection';
import { userCollection } from './db/user-collection';
import { DEMO_ACCOUNTS } from './demo-accounts';

export async function createDemoSeed(): Promise<void> {
  await contentDocumentCollection.create({ contentVersion: MOCK_CURRENT_CONTENT_VERSION });

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
        completedNodeIDs: [...(account.completedNodeIDs ?? [])],
        createdAt: new Date(),
        id: createId(),
        isQA: account.isQA ?? false,
        name: account.avatarName,
        updatedAt: new Date(),
        userID,
      });

      await activeAvatarCollection.create({ avatarID: avatar.id, userID });
    }
  }
}
