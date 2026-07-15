import { expect, test } from 'bun:test';
import { AvatarModeSchema } from './avatar-mode-schema';

test('it accepts trade', () => {
  expect(AvatarModeSchema.safeParse('trade').success).toBeTrue();
});

test('it accepts self_found', () => {
  expect(AvatarModeSchema.safeParse('self_found').success).toBeTrue();
});

test('it rejects an unrecognized mode', () => {
  const result = AvatarModeSchema.safeParse('hardcore');

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toIncludeAllPartialMembers([{ path: [] }]);
});
