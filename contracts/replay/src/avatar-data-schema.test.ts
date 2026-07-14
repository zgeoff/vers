import { expect, test } from 'bun:test';
import { AvatarDataSchema } from './avatar-data-schema';

test('it accepts a well-formed avatar with an equipped weapon', () => {
  const result = AvatarDataSchema.safeParse({
    id: 'avatar_1',
    level: 1,
    life: 200,
    name: 'Test Avatar',
    paperdoll: {
      mainHand: { id: 'weapon_1', maxDamage: 20, minDamage: 10, name: 'Bastard Sword', speed: 0.8 },
    },
    xp: 0,
  });

  expect(result.success).toBeTrue();
});

test('it accepts an avatar with no weapon equipped', () => {
  const result = AvatarDataSchema.safeParse({
    id: 'avatar_1',
    level: 1,
    life: 200,
    name: 'Test Avatar',
    paperdoll: { mainHand: null },
    xp: 0,
  });

  expect(result.success).toBeTrue();
});

test('it rejects an avatar missing its paperdoll', () => {
  const result = AvatarDataSchema.safeParse({
    id: 'avatar_1',
    level: 1,
    life: 200,
    name: 'Test Avatar',
    xp: 0,
  });

  expect(result.success).toBeFalse();
});
