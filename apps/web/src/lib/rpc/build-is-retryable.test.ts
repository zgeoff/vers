import { expect, test } from 'bun:test';
import { avatarContract } from '@vers/contract-avatar';
import { buildIsRetryable } from './build-is-retryable';

test('it allows retry for a GET-declared procedure', () => {
  const isRetryable = buildIsRetryable(avatarContract);

  expect(isRetryable(['getAvatars'])).toBe(true);
});

test('it disallows retry for a POST-declared procedure', () => {
  const isRetryable = buildIsRetryable(avatarContract);

  expect(isRetryable(['createAvatar'])).toBe(false);
});

test('it disallows retry for a path with no matching procedure', () => {
  const isRetryable = buildIsRetryable(avatarContract);

  expect(isRetryable(['doesNotExist'])).toBe(false);
});
