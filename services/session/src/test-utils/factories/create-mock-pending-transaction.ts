import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { PendingTransactions } from '@vers/db';
import type { Insertable } from 'kysely';

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
