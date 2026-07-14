import { createTestAccessToken } from '@vers/mock-services';
import * as db from '@vers/mock-services/db';
import type { UserRowSchema } from '@vers/mock-services/db';
import type * as z from 'zod';

interface SignedInUser {
  readonly cookies: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly sessionID: string;
  readonly user: z.output<typeof UserRowSchema>;
  readonly userID: string;
}

/**
 * Creates a user row and a live, verified session for it, returning the `en_session` cookie map
 * that authenticates as that session under `withRequestContext`. The cookie's access token is a
 * real, fresh signed token, so a driven call resolves the acting user without needing to refresh.
 */
export async function createSignedInUser(
  user: Readonly<Partial<z.input<typeof UserRowSchema>>> = {},
): Promise<SignedInUser> {
  const createdUser = await db.userCollection.create(user);
  const session = await db.sessionCollection.create({ userID: createdUser.id });
  const accessToken = await createTestAccessToken(createdUser.id);

  return {
    cookies: {
      en_session: {
        accessToken,
        refreshToken: session.refreshToken,
        sessionID: session.id,
        userID: createdUser.id,
      },
    },
    sessionID: session.id,
    user: createdUser,
    userID: createdUser.id,
  };
}
