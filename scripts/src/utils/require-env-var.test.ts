import { expect, test } from 'bun:test';
import { updateEnv } from '@vers/test-utils/bun';
import { requireEnvVar } from './require-env-var';

test('it returns the value of a set environment variable', () => {
  updateEnv('SIM_ENGINE_HASH_TEST_VAR', 'abc123');

  expect(requireEnvVar('SIM_ENGINE_HASH_TEST_VAR', 'needed for this test')).toBe('abc123');
});

test('it throws naming the variable and the reason when unset', () => {
  updateEnv('SIM_ENGINE_HASH_TEST_VAR', undefined);

  expect(() =>
    requireEnvVar('SIM_ENGINE_HASH_TEST_VAR', 'needed for this test'),
  ).toThrowWithMessage(Error, 'SIM_ENGINE_HASH_TEST_VAR must be set — needed for this test');
});

test('it throws for an empty-string value', () => {
  updateEnv('SIM_ENGINE_HASH_TEST_VAR', '');

  expect(() => requireEnvVar('SIM_ENGINE_HASH_TEST_VAR', 'needed for this test')).toThrow();
});
