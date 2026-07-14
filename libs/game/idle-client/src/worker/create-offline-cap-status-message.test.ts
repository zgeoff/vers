import { expect, test } from 'bun:test';
import { WorkerMessageType } from '../types';
import { createOfflineCapStatusMessage } from './create-offline-cap-status-message';

test('it carries the remaining budget and halted flag', () => {
  expect(createOfflineCapStatusMessage(120_000, false)).toStrictEqual({
    halted: false,
    remainingMs: 120_000,
    type: WorkerMessageType.OfflineCapStatus,
  });
});
