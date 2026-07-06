import { expect, test } from 'bun:test';
import { removeEnvOverrides, updateEnv } from './env-overrides';

test('it overrides an env var for the duration of the override', () => {
  updateEnv('ENV_OVERRIDES_TEST_OVERRIDE', 'overridden');

  expect(process.env['ENV_OVERRIDES_TEST_OVERRIDE']).toBe('overridden');

  removeEnvOverrides();
});

test('it restores a previously-set var to its original value', () => {
  process.env['ENV_OVERRIDES_TEST_RESTORE'] = 'original';

  updateEnv('ENV_OVERRIDES_TEST_RESTORE', 'overridden');

  removeEnvOverrides();

  expect(process.env['ENV_OVERRIDES_TEST_RESTORE']).toBe('original');

  delete process.env['ENV_OVERRIDES_TEST_RESTORE'];
});

test('it deletes a previously-unset var rather than leaving it overridden', () => {
  delete process.env['ENV_OVERRIDES_TEST_UNSET'];
  updateEnv('ENV_OVERRIDES_TEST_UNSET', 'overridden');

  removeEnvOverrides();

  expect(process.env['ENV_OVERRIDES_TEST_UNSET']).toBeUndefined();
});

test('it keeps the first recorded original across repeated overrides of the same key', () => {
  process.env['ENV_OVERRIDES_TEST_REPEATED'] = 'first-original';

  updateEnv('ENV_OVERRIDES_TEST_REPEATED', 'overridden-once');
  updateEnv('ENV_OVERRIDES_TEST_REPEATED', 'overridden-twice');

  removeEnvOverrides();

  expect(process.env['ENV_OVERRIDES_TEST_REPEATED']).toBe('first-original');

  delete process.env['ENV_OVERRIDES_TEST_REPEATED'];
});
