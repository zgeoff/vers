import { sessionCollection } from '../../db/session-collection';
import { os } from './os';

/**
 * Removes a session owned by the acting user. A foreign or already-missing id is a silent no-op,
 * mirroring the session service: the contract declares no `NOT_FOUND`, so ownership can't be
 * probed by inspecting the response.
 */
export const deleteSession = os.deleteSession.handler((opts) => {
  if (opts.context.actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const session = sessionCollection.findFirst((q) => q.where({ id: opts.input.id }));

  if (session !== undefined && session.userID === opts.context.actingUserId) {
    sessionCollection.delete(session);
  }

  return {};
});
