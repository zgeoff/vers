import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordGrantRefused } from './record-grant-refused';

test('it counts refused step-up grant redemptions', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordGrantRefused();
  recordGrantRefused();

  const refusals = await inMemoryMetrics.readCounterValue('vers.session.step_up_grant_refusals');

  expect(refusals).toBe(2);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordGrantRefused();
  }).not.toThrow();
});
