import { expect, test } from 'bun:test';
import { updateEnv } from './env-overrides';

// This package's own preload calls `registerBunTestCleanup` once for the whole process, so its
// effect is observed across tests rather than within a single one — order-dependent by design.

test('it overrides an env var for this test only', () => {
  updateEnv('REGISTER_BUN_TEST_CLEANUP_PROBE', 'overridden');

  expect(process.env['REGISTER_BUN_TEST_CLEANUP_PROBE']).toBe('overridden');
});

test('it restores the previous test override via the registered global afterEach', () => {
  expect(process.env['REGISTER_BUN_TEST_CLEANUP_PROBE']).toBeUndefined();
});
