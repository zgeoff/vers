import { expect, test } from 'bun:test';
import { STANDARD_ERRORS, UnauthorizedReasonSchema } from './standard-errors';

test('it accepts both unauthorized reason variants', () => {
  expect(UnauthorizedReasonSchema.safeParse('missing-session').success).toBeTrue();
  expect(UnauthorizedReasonSchema.safeParse('expired-session').success).toBeTrue();
});

test('it rejects an unauthorized reason outside the enum', () => {
  const result = UnauthorizedReasonSchema.safeParse('some-other-reason');

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
});

test('it accepts an empty FORBIDDEN data payload', () => {
  expect(STANDARD_ERRORS.FORBIDDEN.data.safeParse({}).success).toBeTrue();
});
