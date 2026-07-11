import { createId } from '@paralleldrive/cuid2';
import * as db from '../../db';
import { os } from './os';

/**
 * Default session lifetime for a login without `rememberMe`, mirroring the session service.
 */
const SESSION_DURATION_SHORT = 24 * 60 * 60 * 1000;

/**
 * Session lifetime for a login with `rememberMe`, mirroring the session service.
 */
const SESSION_DURATION_LONG = 7 * 24 * 60 * 60 * 1000;

export const createSession = os.createSession.handler(async (opts) => {
  const sessionDuration =
    opts.input.rememberMe === true ? SESSION_DURATION_LONG : SESSION_DURATION_SHORT;

  const now = new Date();

  const session = await db.sessionCollection.create({
    createdAt: now,
    expiresAt: opts.input.expiresAt ?? new Date(Date.now() + sessionDuration),
    id: createId(),
    ipAddress: opts.input.ipAddress,
    previousRefreshToken: null,
    refreshToken: null,
    updatedAt: now,
    userID: opts.input.userID,
    verified: false,
  });

  return session;
});
