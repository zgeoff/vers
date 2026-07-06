import { expect, test } from 'bun:test';
import { stubEnv, unstubAllEnvs } from './env-stubbing';

test('it overrides an env var for the duration of the stub', () => {
  stubEnv('ENV_STUBBING_TEST_OVERRIDE', 'stubbed');

  expect(process.env['ENV_STUBBING_TEST_OVERRIDE']).toBe('stubbed');

  unstubAllEnvs();
});

test('it restores a previously-set var to its original value', () => {
  process.env['ENV_STUBBING_TEST_RESTORE'] = 'original';

  stubEnv('ENV_STUBBING_TEST_RESTORE', 'stubbed');

  unstubAllEnvs();

  expect(process.env['ENV_STUBBING_TEST_RESTORE']).toBe('original');

  delete process.env['ENV_STUBBING_TEST_RESTORE'];
});

test('it deletes a previously-unset var rather than leaving it stubbed', () => {
  delete process.env['ENV_STUBBING_TEST_UNSET'];
  stubEnv('ENV_STUBBING_TEST_UNSET', 'stubbed');

  unstubAllEnvs();

  expect(process.env['ENV_STUBBING_TEST_UNSET']).toBeUndefined();
});

test('it keeps the first recorded original across repeated stubs of the same key', () => {
  process.env['ENV_STUBBING_TEST_REPEATED'] = 'first-original';

  stubEnv('ENV_STUBBING_TEST_REPEATED', 'stubbed-once');
  stubEnv('ENV_STUBBING_TEST_REPEATED', 'stubbed-twice');

  unstubAllEnvs();

  expect(process.env['ENV_STUBBING_TEST_REPEATED']).toBe('first-original');

  delete process.env['ENV_STUBBING_TEST_REPEATED'];
});
