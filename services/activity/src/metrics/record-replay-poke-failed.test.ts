import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordReplayPokeFailed } from './record-replay-poke-failed';

test('it counts each exhausted wake delivery', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordReplayPokeFailed();
  recordReplayPokeFailed();

  const pokeFailures = await inMemoryMetrics.readCounterValue('vers.activity.replay_poke_failed');

  expect(pokeFailures).toBe(2);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordReplayPokeFailed();
  }).not.toThrow();
});
