import { expect, mock, test } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import { handleDisconnectMessage } from './handle-disconnect-message';

test('it closes the calling connection once the current turn finishes', async () => {
  const close = mock(() => {});

  handleDisconnectMessage({ close });

  expect(close).not.toHaveBeenCalled();

  await waitFor(() => {
    expect(close).toHaveBeenCalledOnce();
  });
});
