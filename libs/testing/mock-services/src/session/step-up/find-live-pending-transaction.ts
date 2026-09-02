import * as db from '../../db';

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
