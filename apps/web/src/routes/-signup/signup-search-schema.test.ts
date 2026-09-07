import { expect, test } from 'bun:test';
import { SignupSearchSchema } from './signup-search-schema';

test('it keeps a known reason', () => {
  expect(SignupSearchSchema.parse({ reason: 'verification-lapsed' })).toStrictEqual({
    reason: 'verification-lapsed',
  });
});

test('it drops an unknown reason instead of rejecting the search', () => {
  expect(SignupSearchSchema.parse({ reason: 'not-a-reason' })).toStrictEqual({ reason: undefined });
});

test('it accepts a search with no reason', () => {
  expect(SignupSearchSchema.parse({})).toStrictEqual({});
});
