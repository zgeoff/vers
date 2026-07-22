import { expect, test } from 'bun:test';
import { createMockUser } from './create-mock-user';

test('it builds a user with every field defaulted', () => {
  const user = createMockUser();

  expect(user).toContainAllKeys([
    'createdAt',
    'email',
    'id',
    'name',
    'seed',
    'updatedAt',
    'username',
  ]);
});

test('it applies overrides over the defaults', () => {
  const user = createMockUser({ name: 'Karnak' });

  expect(user).toMatchObject({ name: 'Karnak' });
});
