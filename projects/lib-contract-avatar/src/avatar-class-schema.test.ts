import { expect, test } from 'bun:test';
import { AvatarClassSchema } from './avatar-class-schema';

test('it accepts every class value from @vers/data', () => {
  expect(AvatarClassSchema.safeParse('brute').success).toBeTrue();
});

test('it rejects a class outside the enum', () => {
  expect(AvatarClassSchema.safeParse('wizard').success).toBeFalse();
});
