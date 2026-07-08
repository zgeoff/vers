import type * as z from 'zod';
import * as db from '../mocks/db';
import type { UserRowSchema } from '../mocks/db/user-collection';

interface SignedInUser {
  readonly cookies: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly sessionID: string;
  readonly user: z.output<typeof UserRowSchema>;
  readonly userID: string;
}

/**
 * Creates a user row and a live, verified session for it, returning the `en_session` cookie map
 * that authenticates as that session under `withRequestContext`.
 */
export async function createSignedInUser(
  user: Readonly<Partial<z.input<typeof UserRowSchema>>> = {},
): Promise<SignedInUser> {
  const createdUser = await db.userCollection.create(user);
  const session = await db.sessionCollection.create({ userID: createdUser.id });

  return {
    cookies: {
      en_session: { accessToken: session.id, refreshToken: 'refresh', sessionID: session.id },
    },
    sessionID: session.id,
    user: createdUser,
    userID: createdUser.id,
  };
}
