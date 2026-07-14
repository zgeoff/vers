import { expect, onTestFinished, test } from 'bun:test';
import { requireEnvVar } from './require-env-var';

test('it returns the value of a set environment variable', () => {
  const previous = process.env['SIM_ENGINE_HASH_TEST_VAR'];

  process.env['SIM_ENGINE_HASH_TEST_VAR'] = 'abc123';

  onTestFinished(() => {
    if (previous === undefined) {
      delete process.env['SIM_ENGINE_HASH_TEST_VAR'];
    } else {
      process.env['SIM_ENGINE_HASH_TEST_VAR'] = previous;
    }
  });

  expect(requireEnvVar('SIM_ENGINE_HASH_TEST_VAR', 'needed for this test')).toBe('abc123');
});

test('it throws naming the variable and the reason when unset', () => {
  const previous = process.env['SIM_ENGINE_HASH_TEST_VAR'];

  delete process.env['SIM_ENGINE_HASH_TEST_VAR'];

  onTestFinished(() => {
    if (previous !== undefined) {
      process.env['SIM_ENGINE_HASH_TEST_VAR'] = previous;
    }
  });

  expect(() =>
    requireEnvVar('SIM_ENGINE_HASH_TEST_VAR', 'needed for this test'),
  ).toThrowWithMessage(Error, 'SIM_ENGINE_HASH_TEST_VAR must be set — needed for this test');
});

test('it throws for an empty-string value', () => {
  const previous = process.env['SIM_ENGINE_HASH_TEST_VAR'];

  process.env['SIM_ENGINE_HASH_TEST_VAR'] = '';

  onTestFinished(() => {
    if (previous === undefined) {
      delete process.env['SIM_ENGINE_HASH_TEST_VAR'];
    } else {
      process.env['SIM_ENGINE_HASH_TEST_VAR'] = previous;
    }
  });

  expect(() => requireEnvVar('SIM_ENGINE_HASH_TEST_VAR', 'needed for this test')).toThrow();
});
