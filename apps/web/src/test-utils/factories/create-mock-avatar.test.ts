import { expect, test } from 'bun:test';
import { createMockAvatar } from './create-mock-avatar';

test('it builds an avatar with every field defaulted', () => {
  const avatar = createMockAvatar();

  expect(avatar).toContainAllKeys([
    'createdAt',
    'id',
    'level',
    'mode',
    'name',
    'seed',
    'updatedAt',
    'userID',
    'xp',
  ]);
});

test('it applies overrides over the defaults', () => {
  const avatar = createMockAvatar({ level: 5, name: 'Karnak' });

  expect(avatar).toMatchObject({ level: 5, name: 'Karnak' });
});
