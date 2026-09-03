import * as db from '../db';
import { os } from './os';

export const getRevealedNodes = os.getRevealedNodes.handler((opts) => {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = db.avatarCollection.findFirst((q) =>
    q.where({ id: opts.input.avatarID, userID: actingUserID }),
  );

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return { completedNodeIDs: [], contentVersion: db.MOCK_CURRENT_CONTENT_VERSION, nodes: [] };
});
