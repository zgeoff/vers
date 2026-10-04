import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordExpiredSend } from './record-expired-send';

test('it counts expired sends by template', async () => {
  const metrics = createInMemoryMetrics();

  recordExpiredSend('send-welcome');
  recordExpiredSend('send-welcome');
  recordExpiredSend('send-change-email-verification');

  const points = await metrics.readCounterDataPoints('vers.email.expired_sends');

  expect(points).toIncludeAllPartialMembers([
    { attributes: { template: 'send-welcome' }, value: 2 },
    { attributes: { template: 'send-change-email-verification' }, value: 1 },
  ]);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordExpiredSend('send-welcome');
  }).not.toThrow();
});
