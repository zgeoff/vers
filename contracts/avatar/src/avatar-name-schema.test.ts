import { expect, test } from 'bun:test';
import { AvatarNameSchema } from './avatar-name-schema';

test('it accepts an alphabetic name within the length bounds', () => {
  expect(AvatarNameSchema.safeParse('Aria').success).toBeTrue();
});

test('it rejects a name with non-alphabetic characters', () => {
  expect(AvatarNameSchema.safeParse('Aria1').success).toBeFalse();
});
