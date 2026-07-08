import { createId } from '@paralleldrive/cuid2';
import * as db from '../../db';
import { os } from './os';

/**
 * Completes a login for a not-yet-verified session: the mock backend's access token is the
 * session's own id, matching `resolveSessionContext`'s bearer-as-session-id lookup.
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

  return { accessToken: session.id, refreshToken };
});
