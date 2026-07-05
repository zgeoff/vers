import TTLCache from '@isaacs/ttlcache';
import type { SecureAction } from '~/types';

interface TransactionData {
  action: SecureAction;
  attempts: number;
  ipAddress: string;
  sessionID: null | string;
  target: string;
}

/**
 * 5 minute in memory cache to allowlist transaction IDs. This:
 *
 * - binds transaction IDs to their associated data to prevent cross-transaction attacks
 * - prevents replay attacks by tracking verification attempts for a specific transaction ID
 */
export const pendingTransactionCache = new TTLCache<string, TransactionData>({
  ttl: 5 * 60 * 1000,
});
