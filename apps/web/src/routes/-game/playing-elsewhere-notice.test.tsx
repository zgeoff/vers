import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setWriterDisplacedActivityID } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { render } from '../../test-utils/render';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { PlayingElsewhereNotice } from './playing-elsewhere-notice';

test('it renders nothing while no displacement is reported', () => {
  render(<PlayingElsewhereNotice />);

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('it tells the player their run has been picked up on another device, with no way back in', () => {
  setWriterDisplacedActivityID('activity_1');
  render(<PlayingElsewhereNotice />);

  expect(screen.getByText('Playing on another device')).toBeInTheDocument();
  expect(screen.getByText('Your run has been picked up on another device.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Continue here' })).not.toBeInTheDocument();
});

test('it never reports the client back online, since the notice offers no reclaim path', () => {
  const client = createStubWorkerClient();

  setIdleWorkerHandle({
    activity: undefined,
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
  });

  setWriterDisplacedActivityID('activity_1');
  render(<PlayingElsewhereNotice />);

  expect(client.reportOnline).not.toHaveBeenCalled();
});

test('it dismisses by clearing the displaced state, and a fresh displacement re-opens it', async () => {
  const user = userEvent.setup();

  setWriterDisplacedActivityID('activity_1');
  render(<PlayingElsewhereNotice />);

  await user.click(screen.getByRole('button', { name: 'Close' }));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  // any later displacement — the same run taken again after the player signs back in — arrives as
  // a fresh worker broadcast and re-opens the notice
  setWriterDisplacedActivityID('activity_1');

  const dialog = await screen.findByRole('dialog');

  expect(dialog).toBeInTheDocument();
});
