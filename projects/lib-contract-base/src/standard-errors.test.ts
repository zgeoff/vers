import { expect, test } from 'vitest';
import { STANDARD_ERRORS, UnauthorizedReasonSchema } from './standard-errors';

test('it accepts both unauthorized reason variants', () => {
  expect(UnauthorizedReasonSchema.safeParse('missing-session').success).toBeTrue();
  expect(UnauthorizedReasonSchema.safeParse('expired-session').success).toBeTrue();
});

test('it rejects an unauthorized reason outside the enum', () => {
  expect(UnauthorizedReasonSchema.safeParse('some-other-reason').success).toBeFalse();
});

test('it accepts an empty FORBIDDEN data payload', () => {
  expect(STANDARD_ERRORS.FORBIDDEN.data.safeParse({}).success).toBeTrue();
});
