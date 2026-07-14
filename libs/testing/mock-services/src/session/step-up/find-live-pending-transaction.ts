import * as db from '../../db';

/**
 * Looks up a pending step-up transaction by id, treating one past its `expiresAt` the same as
 * missing — an expired row is deleted on read so a stale one never lingers for a later id reuse.
 */
export function findLivePendingTransaction(
  id: string,
): ReturnType<typeof db.pendingTransactionCollection.findFirst> {
  const row = db.pendingTransactionCollection.findFirst((q) => q.where({ id }));

  if (row === undefined) {
    return undefined;
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    db.pendingTransactionCollection.delete(row);

    return undefined;
  }

  return row;
}
