import type { PendingTransactionData, SecureAction } from '@vers/contract-session';
import type { PendingTransactions } from '@vers/db';
import type { Selectable } from 'kysely';

/**
 * Maps a kysely `pending_transactions` row onto the contract's `PendingTransactionData` shape,
 * stripping the row's own timestamps.
 */
export function toPendingTransactionData(
  row: Readonly<Selectable<PendingTransactions>>,
): PendingTransactionData {
  return {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped text; every write is SecureActionSchema-validated contract input
    action: row.action as SecureAction,
    attempts: row.attempts,
    expiresAt: row.expiresAt,
    id: row.id,
    ipAddress: row.ipAddress,
    sessionID: row.sessionId,
    target: row.target,
  };
}
