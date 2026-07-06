import { expect, test } from 'bun:test';
import { createMockSession } from './create-mock-session';

test('it builds a default session row for a given owner', () => {
  const row = createMockSession({ userId: 'user_1' });

  expect(row).toStrictEqual({
    expiresAt: expect.toBeValidDate(),
    id: expect.toBeString(),
    ipAddress: expect.toBeString(),
    userId: 'user_1',
  });
});

test('it applies overrides on top of the defaults', () => {
  const expiresAt = new Date('2020-01-01T00:00:00.000Z');

  const row = createMockSession({ expiresAt, userId: 'user_1' });

  expect(row.expiresAt).toBe(expiresAt);
});
