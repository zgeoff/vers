import { expect, test } from 'bun:test';
import { ClientMessageType } from '../types';
import { createRequestResyncMessage } from './create-request-resync-message';

test('it creates a request resync message', () => {
  const message = createRequestResyncMessage('avatar_1', false);

  expect(message).toStrictEqual({
    avatarID: 'avatar_1',
    claim: false,
    type: ClientMessageType.RequestResync,
  });
});
