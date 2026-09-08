import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordBackoff } from './record-backoff';

test('it counts backoffs by reason', async () => {
  const inMemory = createInMemoryMetrics();

  recordBackoff('keys-unavailable');
  recordBackoff('keys-unavailable');
  recordBackoff('deadline');

  const points = await inMemory.readCounterDataPoints('vers.replay.backoffs');

  expect(points).toIncludeSameMembers([
    { attributes: { reason: 'keys-unavailable' }, value: 2 },
    { attributes: { reason: 'deadline' }, value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordBackoff('errored');
  }).not.toThrow();
});
