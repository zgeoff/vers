import * as db from '../db';
import { os } from './os';

/**
 * Returns the mock current content version with no revealed nodes: the mock db carries no
 * first-clear grant collection to project a disc union from, so every viewport reads as
 * unrevealed. A consumer test asserting on disclosed content stubs this procedure directly via
 * `server.use(...)`.
 */
export const getRevealedNodes = os.getRevealedNodes.handler((opts) => {
  const actingUserId = opts.context.actingUserId;

  if (actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = db.avatarCollection.findFirst((q) =>
    q.where({ id: opts.input.avatarID, userID: actingUserId }),
  );

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return { completedNodeIDs: [], contentVersion: db.MOCK_CURRENT_CONTENT_VERSION, nodes: [] };
});
