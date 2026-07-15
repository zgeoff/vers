import { expect, test } from 'bun:test';
import { WorkerMessageType } from '../types';
import { createConnectionStatusMessage } from './create-connection-status-message';

test('it creates a connection status message', () => {
  const message = createConnectionStatusMessage(false);

  expect(message).toStrictEqual({ online: false, type: WorkerMessageType.ConnectionStatus });
});
