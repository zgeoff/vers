import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordRevealMint } from './record-reveal-mint';

test('it counts the minted node count', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordRevealMint(3);

  const mints = await inMemoryMetrics.readCounterValue('vers.activity.reveal_mints');

  expect(mints).toBe(3);
});

test('it accumulates across calls', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordRevealMint(3);
  recordRevealMint(2);

  const mints = await inMemoryMetrics.readCounterValue('vers.activity.reveal_mints');

  expect(mints).toBe(5);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordRevealMint(3);
  }).not.toThrow();
});
