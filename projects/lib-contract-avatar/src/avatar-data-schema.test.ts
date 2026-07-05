import { expect, test } from 'vitest';
import { AvatarDataSchema } from './avatar-data-schema';

test('it accepts a well-formed avatar', () => {
  const result = AvatarDataSchema.safeParse({
    class: 'scholar',
    createdAt: new Date(),
    id: 'avatar_1',
    level: 1,
    name: 'Aria',
    updatedAt: new Date(),
    userID: 'user_1',
    xp: 0,
  });

  expect(result.success).toBeTrue();
});

test('it rejects an avatar with an invalid class', () => {
  const result = AvatarDataSchema.safeParse({
    class: 'wizard',
    createdAt: new Date(),
    id: 'avatar_1',
    level: 1,
    name: 'Aria',
    updatedAt: new Date(),
    userID: 'user_1',
    xp: 0,
  });

  expect(result.success).toBeFalse();
});
