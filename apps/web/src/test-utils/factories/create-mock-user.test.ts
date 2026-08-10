import { expect, test } from 'bun:test';
import { createMockUser } from './create-mock-user';

test('it builds a default user', () => {
  const user = createMockUser();

  expect(user).toStrictEqual({
    createdAt: expect.toBeDate(),
    email: expect.toBeString(),
    id: expect.toBeString(),
    name: expect.toBeString(),
    seed: expect.toBeNumber(),
    updatedAt: expect.toBeDate(),
    username: expect.toBeString(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const user = createMockUser({ name: 'Karnak' });

  expect(user).toMatchObject({ name: 'Karnak' });
});
