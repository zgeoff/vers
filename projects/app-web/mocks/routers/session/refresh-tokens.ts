import { createId } from '@paralleldrive/cuid2';
import { sessionCollection } from '../../db/session-collection';
import { os } from './os';

/**
 * Rotates a session's refresh token, mirroring the session service's reuse detection: replaying
 * the token rotated away from (`previousRefreshToken`) revokes the whole session.
 */
export const refreshTokens = os.refreshTokens.handler(async (opts) => {
  const session = sessionCollection.findFirst((q) => q.where({ id: opts.input.id }));

  if (session === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    sessionCollection.delete(session);

    throw opts.errors.SESSION_EXPIRED({ data: {} });
  }

  if (
    session.previousRefreshToken !== null &&
    opts.input.refreshToken === session.previousRefreshToken
  ) {
    sessionCollection.delete(session);

    throw opts.errors.REFRESH_TOKEN_REUSED({ data: {} });
  }

  if (session.refreshToken === null || opts.input.refreshToken !== session.refreshToken) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const rotatedRefreshToken = createId();

  await sessionCollection.update(session, {
    data(record) {
      record.previousRefreshToken = session.refreshToken;
      record.refreshToken = rotatedRefreshToken;
    },
  });

  return { accessToken: session.id, refreshToken: rotatedRefreshToken };
});
