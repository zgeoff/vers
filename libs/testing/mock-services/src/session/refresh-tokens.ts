import { createId } from '@paralleldrive/cuid2';
import { createTestAccessToken } from '../create-test-access-token';
import * as db from '../db';
import { os } from './os';

export const refreshTokens = os.refreshTokens.handler(async (opts) => {
  const session = db.sessionCollection.findFirst((q) => q.where({ id: opts.input.id }));

  if (session === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    db.sessionCollection.delete(session);
    throw opts.errors.SESSION_EXPIRED({ data: {} });
  }

  if (
    session.previousRefreshToken !== null &&
    opts.input.refreshToken === session.previousRefreshToken
  ) {
    db.sessionCollection.delete(session);
    throw opts.errors.REFRESH_TOKEN_REUSED({ data: {} });
  }

  if (session.refreshToken === null || opts.input.refreshToken !== session.refreshToken) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const rotatedRefreshToken = createId();

  await db.sessionCollection.update(session, {
    data(record) {
      record.previousRefreshToken = session.refreshToken;
      record.refreshToken = rotatedRefreshToken;
    },
  });

  return {
    accessToken: await createTestAccessToken(session.userID),
    refreshToken: rotatedRefreshToken,
  };
});
