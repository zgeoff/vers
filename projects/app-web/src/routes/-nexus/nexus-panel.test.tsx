import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { screen } from '@testing-library/react';
import { avatarCollection } from '../../../mocks/db/avatar-collection';
import { sessionCollection } from '../../../mocks/db/session-collection';
import { userCollection } from '../../../mocks/db/user-collection';
import { renderWithRouter } from '../../../test-utils/render-with-router';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { orpc } from '../../lib/rpc/orpc';
import { NexusPanel } from './nexus-panel';

async function createSignedInUser(): Promise<{
  readonly cookies: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly userID: string;
}> {
  const userID = createId();
  const sessionID = createId();

  await userCollection.create({
    createdAt: new Date(),
    email: 'nexus-panel@vers.test',
    id: userID,
    name: 'Nexus Panel',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: 'nexus-panel',
  });

  await sessionCollection.create({
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    id: sessionID,
    ipAddress: '127.0.0.1',
    previousRefreshToken: null,
    refreshToken: null,
    updatedAt: new Date(),
    userID,
    verified: true,
  });

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

  await avatarCollection.create({
    class: 'brute',
    createdAt: new Date(),
    id: createId(),
    level: 1,
    name: 'Karnak',
    updatedAt: new Date(),
    userID: signedIn.userID,
    xp: 0,
  });

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
