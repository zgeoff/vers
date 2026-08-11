import { expect, test } from 'bun:test';
import { createMockAvatar } from './create-mock-avatar';

test('it builds a default avatar', () => {
  const avatar = createMockAvatar();

  expect(avatar).toStrictEqual({
    createdAt: expect.toBeDate(),
    id: expect.toBeString(),
    level: expect.toBeNumber(),
    mode: 'trade',
    name: expect.toBeString(),
    seed: expect.toBeNumber(),
    updatedAt: expect.toBeDate(),
    userID: expect.toBeString(),
    xp: expect.toBeNumber(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const avatar = createMockAvatar({ level: 5, name: 'Karnak' });

  expect(avatar).toMatchObject({ level: 5, name: 'Karnak' });
});
