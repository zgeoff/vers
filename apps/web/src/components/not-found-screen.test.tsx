import { expect, test } from 'bun:test';
import { buildQueryClient } from '../lib/query/build-query-client';
import { orpc } from '../lib/rpc/orpc';
import { createActiveAvatar } from '../test-utils/create-active-avatar';
import { createSignedInUser } from '../test-utils/create-signed-in-user';
import { renderWithRouter } from '../test-utils/render-with-router';
import { withRequestContext } from '../test-utils/with-request-context';
import { NotFoundScreen } from './not-found-screen';

test('it tells a signed-out visitor the page does not exist and links home', async () => {
  const rendered = renderWithRouter(<NotFoundScreen />);

  const message = await rendered.findByText('This page does not exist.');

  expect(message).toBeVisible();
  expect(rendered.getByRole('heading', { name: 'vers' })).toBeVisible();
  expect(rendered.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
  expect(rendered.queryByRole('link', { name: 'Open the map' })).not.toBeInTheDocument();
});

test('it also links to the map once a game screen has loaded the avatars', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ userID: signedIn.userID });

  const queryClient = buildQueryClient();

  await withRequestContext({ cookies: signedIn.cookies }, () =>
    queryClient.prefetchQuery(orpc.avatar.getAvatars.queryOptions({ input: {} })),
  );

  const rendered = renderWithRouter(<NotFoundScreen />, { queryClient });

  const mapLink = await rendered.findByRole('link', { name: 'Open the map' });

  expect(mapLink).toHaveAttribute('href', '/explore');
  expect(rendered.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
});
