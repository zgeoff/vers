import { expect, test } from 'bun:test';
import type { AvatarData } from './avatar-data-schema';
import { AvatarDataSchema } from './avatar-data-schema';

test('it accepts a well-formed trade-mode avatar', () => {
  const payload: AvatarData = {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    id: 'avatar_1',
    level: 5,
    mode: 'trade',
    name: 'Karnak',
    seed: 12_345,
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    userID: 'user_1',
    xp: 4200,
  };

  expect(AvatarDataSchema.parse(payload)).toStrictEqual(payload);
});

test('it accepts a well-formed self_found-mode avatar', () => {
  const payload: AvatarData = {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    id: 'avatar_1',
    level: 5,
    mode: 'self_found',
    name: 'Karnak',
    seed: 12_345,
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    userID: 'user_1',
    xp: 4200,
  };

  expect(AvatarDataSchema.parse(payload)).toStrictEqual(payload);
});

test('it rejects an unrecognized mode', () => {
  const payload = {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    id: 'avatar_1',
    level: 5,
    mode: 'hardcore',
    name: 'Karnak',
    seed: 12_345,
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    userID: 'user_1',
    xp: 4200,
  };

  const result = AvatarDataSchema.safeParse(payload);

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['mode'] }));
});
