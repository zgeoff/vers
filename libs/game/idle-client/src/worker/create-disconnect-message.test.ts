import { expect, test } from 'bun:test';
import { ClientMessageType } from '../types';
import { createDisconnectMessage } from './create-disconnect-message';

test('it creates a disconnect message', () => {
  const message = createDisconnectMessage();

  expect(message).toStrictEqual({
    type: ClientMessageType.Disconnect,
  });
});
