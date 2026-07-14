import { expect, test } from 'bun:test';
import { AvatarDataSchema } from '../../avatar-data-schema';
import { createMockAvatarData } from './create-mock-avatar-data';

test('it builds a contract-valid avatar', () => {
  const avatar = createMockAvatarData();

  expect(AvatarDataSchema.parse(avatar)).toStrictEqual(avatar);
});

test('it applies overrides over the defaults', () => {
  const avatar = createMockAvatarData({ level: 12, name: 'Karnak', xp: 4500 });

  expect(avatar.level).toBe(12);
  expect(avatar.name).toBe('Karnak');
  expect(avatar.xp).toBe(4500);
});
