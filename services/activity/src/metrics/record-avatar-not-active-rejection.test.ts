import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordAvatarNotActiveRejection } from './record-avatar-not-active-rejection';

test('it counts each avatar-not-active rejection', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordAvatarNotActiveRejection();
  recordAvatarNotActiveRejection();

  const rejections = await inMemoryMetrics.readCounterValue(
    'vers.activity.avatar_not_active_rejections',
  );

  expect(rejections).toBe(2);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordAvatarNotActiveRejection();
  }).not.toThrow();
});
