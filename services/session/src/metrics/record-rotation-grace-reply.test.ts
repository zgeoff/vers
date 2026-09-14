import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordRotationGraceReply } from './record-rotation-grace-reply';

test('it counts each rotation-grace reply', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordRotationGraceReply();
  recordRotationGraceReply();

  const replies = await inMemoryMetrics.readCounterValue('vers.session.rotation_grace_replies');

  expect(replies).toBe(2);
});

test('it stays inert without a registered meter provider', () => {
  expect(() => {
    recordRotationGraceReply();
  }).not.toThrow();
});
