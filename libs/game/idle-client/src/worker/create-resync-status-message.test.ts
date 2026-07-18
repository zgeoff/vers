import { expect, test } from 'bun:test';
import { WorkerMessageType } from '../types';
import { createResyncStatusMessage } from './create-resync-status-message';

test('it creates a resync status message', () => {
  const message = createResyncStatusMessage({ kind: 'capped' });

  expect(message).toStrictEqual({
    status: { kind: 'capped' },
    type: WorkerMessageType.ResyncStatus,
  });
});

test('it creates a resync status message for a failed catch-up', () => {
  const message = createResyncStatusMessage({ avatarID: 'avatar-1', kind: 'failed' });

  expect(message).toStrictEqual({
    status: { avatarID: 'avatar-1', kind: 'failed' },
    type: WorkerMessageType.ResyncStatus,
  });
});
