import { expect, test } from 'bun:test';
import type { DisconnectMessage, InitializeMessage } from '../types';
import { ClientMessageType } from '../types';
import { isInitializeMessage } from './is-initialize-message';

test('it returns true if it is an initialize message', () => {
  const message: InitializeMessage = {
    type: ClientMessageType.Initialize,
  };

  expect(isInitializeMessage(message)).toBeTrue();
});

test('it returns false if it is not an initialize message', () => {
  const message: DisconnectMessage = {
    type: ClientMessageType.Disconnect,
  };

  expect(isInitializeMessage(message)).toBeFalse();
});
