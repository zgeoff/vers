import type * as z from 'zod';
import { createTestAccessToken } from './create-test-access-token';
import type { AvatarRowSchema, UserRowSchema } from './db';
import { activeAvatarCollection, avatarCollection, userCollection } from './db';

interface CreateViewerConfig {
  readonly avatar?: z.input<typeof AvatarRowSchema>;
  readonly user?: z.input<typeof UserRowSchema>;
}

interface Viewer {
  readonly avatar: z.output<typeof AvatarRowSchema>;
  readonly token: string;
  readonly user: z.output<typeof UserRowSchema>;
}

export async function createViewer(config: Readonly<CreateViewerConfig> = {}): Promise<Viewer> {
  const user = await userCollection.create(config.user ?? {});

  const avatar = await avatarCollection.create({
    ...config.avatar,
    userID: config.avatar?.userID ?? user.id,
  });

  await activeAvatarCollection.create({ avatarID: avatar.id, userID: avatar.userID });

  const token = await createTestAccessToken(user.id);

  return { avatar, token, user };
}
