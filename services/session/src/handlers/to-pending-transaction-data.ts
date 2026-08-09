import type { PendingTransactionData } from '@vers/contract-session';
import { SecureActionSchema } from '@vers/contract-session';
import type { PendingTransactions } from '@vers/db';
import type { Selectable } from 'kysely';

/**
 * Maps a kysely `pending_transactions` row onto the contract's `PendingTransactionData` shape,
 * stripping the row's own timestamps. `action` is an untyped text column and re-enters typed code
 * through its contract schema, so a drifted row fails here loudly instead of flowing on.
 */
export function toPendingTransactionData(
  row: Readonly<Selectable<PendingTransactions>>,
): PendingTransactionData {
  return {
    action: SecureActionSchema.parse(row.action),
    attempts: row.attempts,
    expiresAt: row.expiresAt,
    id: row.id,
    ipAddress: row.ipAddress,
    sessionID: row.sessionId,
    target: row.target,
  };
}
