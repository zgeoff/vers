import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import * as db from '@vers/mock-services/db';
import { orpc } from '../../lib/rpc/orpc';
import { createActiveAvatar } from '../../test-utils/create-active-avatar';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { RespitePanel } from './respite-panel';

test('it shows a call to action for a caller with no avatar', async () => {
  const signedIn = await createSignedInUser();

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<RespitePanel orpc={orpc} />);

    const callToAction = await screen.findByText('Awaken your Avatar');

    expect(callToAction).toBeVisible();
    expect(callToAction.closest('a')).toHaveAttribute('href', '/avatars/create');
  });
});

test('it routes a caller with avatars but no selection to the roster', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ name: 'Karnak', userID: signedIn.userID });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<RespitePanel orpc={orpc} />);

    const callToAction = await screen.findByText('Choose your Avatar');

    expect(callToAction).toBeVisible();
    expect(callToAction.closest('a')).toHaveAttribute('href', '/avatars');
  });
});

test('it shows the respite hud for a caller with an avatar', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ name: 'Karnak', userID: signedIn.userID });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<RespitePanel orpc={orpc} />);

    const heading = await screen.findByText('Respite');

    expect(heading).toBeVisible();
  });
});

test('it reports an error for a caller with no live session', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<RespitePanel orpc={orpc} />);

    const message = await screen.findByTestId('respite-error');

    expect(message).toHaveTextContent('No valid session');
  });
});
