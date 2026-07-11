import { expect, test } from 'bun:test';
import type { DisconnectMessage, InitializeMessage } from '../types';
import { ClientMessageType } from '../types';
import { isDisconnectMessage } from './is-disconnect-message';

test('it returns true if it is a disconnect message', () => {
  const message: DisconnectMessage = {
    type: ClientMessageType.Disconnect,
  };

  expect(isDisconnectMessage(message)).toBeTrue();
});

test('it returns false if it is not a disconnect message', () => {
  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  expect(isDisconnectMessage(message)).toBeFalse();
});
