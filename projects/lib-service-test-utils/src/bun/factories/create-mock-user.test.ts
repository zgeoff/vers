import { expect, test } from 'bun:test';
import { createMockUser } from './create-mock-user';

test('it builds a default user row', () => {
  const row = createMockUser();

  expect(row).toStrictEqual({
    createdAt: expect.toBeValidDate(),
    email: expect.toInclude('@'),
    id: expect.toBeString(),
    name: expect.toBeString(),
    passwordHash: null,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
    seed: expect.toBeNumber(),
    updatedAt: expect.toBeValidDate(),
    username: expect.toBeString(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const row = createMockUser({ email: 'fixed@test.com', username: 'fixed_user' });

  expect(row.email).toBe('fixed@test.com');
  expect(row.username).toBe('fixed_user');
});
