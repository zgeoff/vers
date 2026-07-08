import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { screen } from '@testing-library/react';
import { orpc } from '../../lib/rpc/orpc';
import * as db from '../../mocks/db';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { NexusPanel } from './nexus-panel';

async function createSignedInUser(): Promise<{
  readonly cookies: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly userID: string;
}> {
  const userID = createId();
  const sessionID = createId();

  await db.userCollection.create({ id: userID });

  await db.sessionCollection.create({ id: sessionID, userID });

  return {
    cookies: { en_session: { accessToken: sessionID, refreshToken: 'refresh', sessionID } },
    userID,
  };
}

test('it shows a call to action for a caller with no avatar', async () => {
  const signedIn = await createSignedInUser();

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<NexusPanel orpc={orpc} />);

    const callToAction = await screen.findByText('Awaken your Avatar');

    expect(callToAction).toBeVisible();
    expect(callToAction.closest('a')).toHaveAttribute('href', '/avatar/create');
  });
});

test('it shows the nexus hud for a caller with an avatar', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ name: 'Karnak', userID: signedIn.userID });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<NexusPanel orpc={orpc} />);

    const heading = await screen.findByText('Nexus');

    expect(heading).toBeVisible();
  });
});

test('it reports an error for a caller with no live session', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<NexusPanel orpc={orpc} />);

    const message = await screen.findByTestId('nexus-error');

    expect(message).toHaveTextContent('No valid session');
  });
});
