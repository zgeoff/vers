import { expect, test } from 'bun:test';
import { createMockSession } from './create-mock-session';

test('it builds a default session row', () => {
  const row = createMockSession();

  expect(row).toStrictEqual({
    expiresAt: expect.toBeDate(),
    id: expect.toBeString(),
    ipAddress: expect.toBeString(),
    previousRefreshToken: null,
    refreshToken: null,
    userId: expect.toBeString(),
    verified: false,
  });
});

test('it applies overrides on top of the defaults', () => {
  const row = createMockSession({ userId: 'user_1', verified: true });

  expect(row).toStrictEqual({
    expiresAt: expect.toBeDate(),
    id: expect.toBeString(),
    ipAddress: expect.toBeString(),
    previousRefreshToken: null,
    refreshToken: null,
    userId: 'user_1',
    verified: true,
  });
});
