import { expect, test } from 'bun:test';
import { AvatarDataSchema } from './avatar-data-schema';

test('it accepts a well-formed avatar', () => {
  const result = AvatarDataSchema.safeParse({
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
