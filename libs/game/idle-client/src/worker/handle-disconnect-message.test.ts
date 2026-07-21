import { expect, mock, test } from 'bun:test';
import { handleDisconnectMessage } from './handle-disconnect-message';

test('it closes the calling connection once the current turn finishes', async () => {
  const close = mock(() => {});

  handleDisconnectMessage({ close });

  expect(close).not.toHaveBeenCalled();

  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

  expect(close).toHaveBeenCalledOnce();
});
