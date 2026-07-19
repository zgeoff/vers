import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { orpc } from '../../lib/rpc/orpc';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { HomeHero } from './home-hero';

test('it invites an anonymous visitor to log in or sign up', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<HomeHero orpc={orpc} />);

    const login = await screen.findByText('Log in');

    expect(login.closest('a')).toHaveAttribute('href', '/login');
    expect(screen.getByText('Sign up').closest('a')).toHaveAttribute('href', '/signup');
  });
});

test('it welcomes a signed-in visitor with links into the game and account', async () => {
  const signedIn = await createSignedInUser({ name: 'Demo Account' });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<HomeHero orpc={orpc} />);

    const welcome = await screen.findByText('Welcome back, Demo Account.');

    expect(welcome).toBeVisible();
    expect(screen.getByText('Enter game').closest('a')).toHaveAttribute('href', '/avatars');
    expect(screen.getByText('Account').closest('a')).toHaveAttribute('href', '/account');
  });
});
