import { expect, test } from 'bun:test';
import { createMockUser } from './create-mock-user';

test('it builds a plain, unpersisted user row with faker-generated identity fields', () => {
  const row = createMockUser();

  expect(row.email).toInclude('@');
  expect(row.username).toBeString();
  expect(row.name).toBeString();
  expect(row.passwordHash).toBeNull();
});

test('it generates distinct identity fields on repeated calls', () => {
  const first = createMockUser();
  const second = createMockUser();

  expect(first.email).not.toBe(second.email);
  expect(first.username).not.toBe(second.username);
  expect(first.id).not.toBe(second.id);
});

test('it applies overrides on top of the faker defaults', () => {
  const row = createMockUser({ email: 'fixed@test.com', username: 'fixed_user' });

  expect(row.email).toBe('fixed@test.com');
  expect(row.username).toBe('fixed_user');
});
