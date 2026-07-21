import { expect, test } from 'bun:test';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ClientMessage } from '@vers/idle-client';
import { ClientMessageType, setWriterDisplacedActivityID } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import * as db from '@vers/mock-services/db';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { render } from '../../test-utils/render';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { PlayingElsewhereNotice } from './playing-elsewhere-notice';

test('it renders nothing while no displacement is reported', () => {
  render(<PlayingElsewhereNotice />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('it tells the player their run picked up on another device', () => {
  setWriterDisplacedActivityID('activity_1');
  render(<PlayingElsewhereNotice />);
  expect(screen.getByText('Playing on another device')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue here' })).toBeInTheDocument();
});

test('it claims the run back with a claiming report on continue-here', async () => {
  const user = userEvent.setup();

  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const calls: Array<ClientMessage> = [];
  const transport = { post: (message: ClientMessage) => calls.push(message) };

  setIdleWorkerHandle({
    activity: undefined,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    transport,
  });

  setWriterDisplacedActivityID('activity_1');

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    render(<PlayingElsewhereNotice />);

    // a click lands only once the avatar id has resolved; an early one leaves the notice open,
    // so the loop retries exactly as a player would
    await waitFor(async () => {
      await user.click(screen.getByRole('button', { name: 'Continue here' }));

      expect(calls.filter((call) => call.type === ClientMessageType.ReportOnline)).toStrictEqual([
        { avatarID: avatar.id, claim: true, type: ClientMessageType.ReportOnline },
      ]);
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

test('it dismisses by clearing the displaced state, and a fresh displacement re-opens it', async () => {
  const user = userEvent.setup();

  setWriterDisplacedActivityID('activity_1');
  render(<PlayingElsewhereNotice />);

  await user.click(screen.getByRole('button', { name: 'Close' }));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  // any later displacement — the same run taken again after a take-back included — arrives as a
  // fresh worker broadcast and re-opens the notice
  setWriterDisplacedActivityID('activity_1');

  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
