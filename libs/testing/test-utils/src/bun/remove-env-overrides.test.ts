import { expect, test } from 'bun:test';
import { removeEnvOverrides } from './remove-env-overrides';
import { updateEnv } from './update-env';

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
