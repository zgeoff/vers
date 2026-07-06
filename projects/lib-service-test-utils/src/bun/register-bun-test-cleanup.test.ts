import { expect, test } from 'bun:test';
import { stubEnv } from './env-stubbing';

// This package's own preload calls `registerBunTestCleanup` once for the whole process, so its
// effect is observed across tests rather than within a single one — order-dependent by design.

test('it stubs an env var for this test only', () => {
  stubEnv('REGISTER_BUN_TEST_CLEANUP_PROBE', 'stubbed');

  expect(process.env['REGISTER_BUN_TEST_CLEANUP_PROBE']).toBe('stubbed');
});

test('it restores the previous test stub via the registered global afterEach', () => {
  expect(process.env['REGISTER_BUN_TEST_CLEANUP_PROBE']).toBeUndefined();
});
