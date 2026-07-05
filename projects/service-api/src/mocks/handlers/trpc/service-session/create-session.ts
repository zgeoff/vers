import { db } from '../../../db';
import { trpc } from './trpc';

const EXPIRES_AT_OFFSET = 1000 * 60 * 60 * 24 * 1;
const EXPIRES_AT_REMEMBER_ME_OFFSET = 1000 * 60 * 60 * 24 * 30;

export const createSession = trpc.createSession.mutation((opts) => {
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  const expiryOffset = opts.input.rememberMe ? EXPIRES_AT_REMEMBER_ME_OFFSET : EXPIRES_AT_OFFSET;

  const expiresAt = opts.input.expiresAt
    ? new Date(opts.input.expiresAt)
    : new Date(Date.now() + expiryOffset);

  const session = db.session.create({
    expiresAt,
    ipAddress: opts.input.ipAddress,
    refreshToken: null,
    userID: opts.input.userID,
    verified: false,
  });

  return session;
});
