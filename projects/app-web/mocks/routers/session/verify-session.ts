import { createId } from '@paralleldrive/cuid2';
import { sessionCollection } from '../../db/session-collection';
import { os } from './os';

/**
 * Completes a login for a not-yet-verified session: the mock backend's access token is the
 * session's own id, matching `resolveSessionContext`'s bearer-as-session-id lookup.
 */
export const verifySession = os.verifySession.handler(async (opts) => {
  const session = sessionCollection.findFirst((q) => q.where({ id: opts.input.id }));

  if (session === undefined || session.verified) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const refreshToken = createId();

  await sessionCollection.update(session, {
    data(record) {
      record.refreshToken = refreshToken;
      record.verified = true;
    },
  });

  return { accessToken: session.id, refreshToken };
});
