import { expect, test } from 'bun:test';
import { AvatarDataSchema } from './avatar-data-schema';
import { createMockAvatarData } from './test-utils/factories/create-mock-avatar-data';

test('it accepts a well-formed trade-mode avatar', () => {
  const result = AvatarDataSchema.safeParse(createMockAvatarData({ mode: 'trade' }));

  expect(result.success).toBeTrue();
});

test('it accepts a well-formed self_found-mode avatar', () => {
  const result = AvatarDataSchema.safeParse(createMockAvatarData({ mode: 'self_found' }));

  expect(result.success).toBeTrue();
});

test('it rejects an unrecognized mode', () => {
  const result = AvatarDataSchema.safeParse({ ...createMockAvatarData(), mode: 'hardcore' });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['mode'] }));
});
