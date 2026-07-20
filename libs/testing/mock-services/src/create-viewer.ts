import type * as z from 'zod';
import { createTestAccessToken } from './create-test-access-token';
import type { AvatarRowSchema, UserRowSchema } from './db';
import { avatarCollection, userCollection } from './db';

interface CreateViewerConfig {
  readonly avatar?: z.input<typeof AvatarRowSchema>;
  readonly user?: z.input<typeof UserRowSchema>;
}

interface Viewer {
  readonly avatar: z.output<typeof AvatarRowSchema>;
  readonly token: string;
  readonly user: z.output<typeof UserRowSchema>;
}

/**
 * An acting user seeded into the mock store: a user row, an avatar row linked to it, and an access
 * token minted for the user — the MSW-regime counterpart of the real-database viewer composite.
 * Overrides pass through to the collections' defaults; the avatar's user linkage comes free, though
 * an explicit `avatar.userID` override still wins. Returns data only — callers build their own
 * client for the transport they exercise.
 */
export async function createViewer(config: Readonly<CreateViewerConfig> = {}): Promise<Viewer> {
  const user = await userCollection.create(config.user ?? {});

  const avatar = await avatarCollection.create({
    ...config.avatar,
    userID: config.avatar?.userID ?? user.id,
  });

  const token = await createTestAccessToken(user.id);

  return { avatar, token, user };
}
