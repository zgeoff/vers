import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { PendingTransactions } from '@vers/db';
import type { Insertable } from 'kysely';

/**
 * A plain, unpersisted pending-transaction row with faker-generated defaults. Never requires a
 * parent — `sessionId` defaults to null, a real session id is only needed for tests that scope a
 * transaction to one.
 */
export function createMockPendingTransaction(
  overrides: Partial<Insertable<PendingTransactions>> = {},
): Insertable<PendingTransactions> {
  return {
    action: 'TwoFactorAuth',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    id: createId(),
    ipAddress: faker.internet.ip(),
    sessionId: null,
    target: faker.internet.email(),
    ...overrides,
  };
}
