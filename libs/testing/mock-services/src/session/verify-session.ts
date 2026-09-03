import { createId } from '@paralleldrive/cuid2';
import { createTestAccessToken } from '../create-test-access-token';
import * as db from '../db';
import { os } from './os';

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

  return { accessToken: await createTestAccessToken(session.userID), refreshToken };
});
