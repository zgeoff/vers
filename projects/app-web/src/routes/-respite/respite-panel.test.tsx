import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { orpc } from '../../lib/rpc/orpc';
import * as db from '../../mocks/db';
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
    expect(callToAction.closest('a')).toHaveAttribute('href', '/avatar/create');
  });
});

test('it shows the respite hud for a caller with an avatar', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ name: 'Karnak', userID: signedIn.userID });

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
