import { sessionCollection } from '../../db/session-collection';
import { os } from './os';

export const getSession = os.getSession.handler((opts) => {
  const { actingUserId } = opts.context;

  if (actingUserId === null) {
    throw new Error('not wired in the phase 0b mock backend');
  }

  const session = sessionCollection.findFirst((q) => q.where({ id: opts.input.id }));

  if (session === undefined || session.userID !== actingUserId) {
    return null;
  }

  return session;
});
