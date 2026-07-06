import { expect, test } from 'bun:test';
import { createMockPendingTransaction } from './create-mock-pending-transaction';

test('it builds a default pending-transaction row', () => {
  const row = createMockPendingTransaction();

  expect(row).toStrictEqual({
    action: 'TwoFactorAuth',
    expiresAt: expect.toBeDate(),
    id: expect.toBeString(),
    ipAddress: expect.toBeString(),
    sessionId: null,
    target: expect.toBeString(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const row = createMockPendingTransaction({ action: 'ChangeEmail', sessionId: 'session_1' });

  expect(row).toStrictEqual({
    action: 'ChangeEmail',
    expiresAt: expect.toBeDate(),
    id: expect.toBeString(),
    ipAddress: expect.toBeString(),
    sessionId: 'session_1',
    target: expect.toBeString(),
  });
});
