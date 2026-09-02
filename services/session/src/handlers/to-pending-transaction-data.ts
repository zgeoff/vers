import type { PendingTransactionData } from '@vers/contract-session';
import { SecureActionSchema } from '@vers/contract-session';
import type { PendingTransactions } from '@vers/db';
import type { Selectable } from 'kysely';

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
