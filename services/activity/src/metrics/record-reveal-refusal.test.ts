import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordRevealRefusal } from './record-reveal-refusal';

test('it counts the refused node count', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordRevealRefusal(2);

  const refusals = await inMemoryMetrics.readCounterValue('vers.activity.reveal_refusals');

  expect(refusals).toBe(2);
});

test('it accumulates across calls', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordRevealRefusal(2);
  recordRevealRefusal(3);

  const refusals = await inMemoryMetrics.readCounterValue('vers.activity.reveal_refusals');

  expect(refusals).toBe(5);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordRevealRefusal(2);
  }).not.toThrow();
});
