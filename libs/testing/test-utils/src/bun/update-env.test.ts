import { expect, test } from 'bun:test';
import { removeEnvOverrides } from './remove-env-overrides';
import { updateEnv } from './update-env';

test('it overrides an env var for the duration of the override', () => {
  updateEnv('ENV_OVERRIDES_TEST_OVERRIDE', 'overridden');

  expect(process.env['ENV_OVERRIDES_TEST_OVERRIDE']).toBe('overridden');

  removeEnvOverrides();
});

test('it unsets an env var for the duration of the override', () => {
  process.env['ENV_OVERRIDES_TEST_UNSET'] = 'original';

  updateEnv('ENV_OVERRIDES_TEST_UNSET', undefined);

  expect(process.env['ENV_OVERRIDES_TEST_UNSET']).toBeUndefined();

  removeEnvOverrides();

  expect(process.env['ENV_OVERRIDES_TEST_UNSET']).toBe('original');
  delete process.env['ENV_OVERRIDES_TEST_UNSET'];
});

test('it keeps the first recorded original across repeated overrides of the same key', () => {
  process.env['ENV_OVERRIDES_TEST_REPEATED'] = 'first-original';

  updateEnv('ENV_OVERRIDES_TEST_REPEATED', 'overridden-once');
  updateEnv('ENV_OVERRIDES_TEST_REPEATED', 'overridden-twice');
  removeEnvOverrides();

  expect(process.env['ENV_OVERRIDES_TEST_REPEATED']).toBe('first-original');
  delete process.env['ENV_OVERRIDES_TEST_REPEATED'];
});
