import { createId } from '@paralleldrive/cuid2';
import { createMockAccessToken } from '../../create-mock-access-token';
import * as db from '../../db';
import { os } from './os';

/**
 * Completes a login for a not-yet-verified session, minting the tokens the edge caches, then
 * evicts every other session belonging to the same user — mirroring the service's single-verified-
 * session enforcement — along with those evicted sessions' pending step-up transactions.
 */
export const verifySession = os.verifySession.handler(async (opts) => {
  const session = db.sessionCollection.findFirst((q) => q.where({ id: opts.input.id }));

  if (session === undefined || session.verified) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const refreshToken = createId();

  await db.sessionCollection.update(session, {
    data(record) {
      record.refreshToken = refreshToken;
      record.verified = true;
    },
  });

  const otherSessions = db.sessionCollection.findMany((q) =>
    q.where({ id: (id) => id !== session.id, userID: session.userID }),
  );

  for (const otherSession of otherSessions) {
    db.pendingTransactionCollection.deleteMany((q) => q.where({ sessionID: otherSession.id }));
    db.sessionCollection.delete(otherSession);
  }

  return { accessToken: await createMockAccessToken(session.userID), refreshToken };
});
