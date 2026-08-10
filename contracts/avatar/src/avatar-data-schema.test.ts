import { expect, test } from 'bun:test';
import { AvatarDataSchema } from './avatar-data-schema';

test('it accepts a well-formed trade-mode avatar', () => {
  const result = AvatarDataSchema.safeParse({
    createdAt: new Date(),
    id: 'avatar_1',
    level: 1,
    mode: 'trade',
    name: 'Aria',
    seed: 1,
    updatedAt: new Date(),
    userID: 'user_1',
    xp: 0,
  });

  expect(result.success).toBeTrue();
});

test('it accepts a well-formed self_found-mode avatar', () => {
  const result = AvatarDataSchema.safeParse({
    createdAt: new Date(),
    id: 'avatar_1',
    level: 1,
    mode: 'self_found',
    name: 'Aria',
    seed: 1,
    updatedAt: new Date(),
    userID: 'user_1',
    xp: 0,
  });

  expect(result.success).toBeTrue();
});

test('it rejects an unrecognized mode', () => {
  const result = AvatarDataSchema.safeParse({
    createdAt: new Date(),
    id: 'avatar_1',
    level: 1,
    mode: 'hardcore',
    name: 'Aria',
    updatedAt: new Date(),
    userID: 'user_1',
    xp: 0,
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['mode'] }));
});
