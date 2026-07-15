import { expect, test } from 'bun:test';
import { WorkerMessageType } from '../types';
import { createResyncStatusMessage } from './create-resync-status-message';

test('it creates a resync status message', () => {
  const message = createResyncStatusMessage({ kind: 'checking' });

  expect(message).toStrictEqual({
    status: { kind: 'checking' },
    type: WorkerMessageType.ResyncStatus,
  });
});
