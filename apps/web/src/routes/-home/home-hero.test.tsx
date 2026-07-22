import { expect, test } from 'bun:test';
import { createMockUser } from '../../test-utils/factories/create-mock-user';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { HomeHero } from './home-hero';

test('it invites an anonymous visitor to log in or sign up', async () => {
  const rendered = renderWithRouter(<HomeHero user={null} />);

  const login = await rendered.findByText('Log in');

  expect(login.closest('a')).toHaveAttribute('href', '/login');
  expect(rendered.getByText('Sign up').closest('a')).toHaveAttribute('href', '/signup');
});

test('it welcomes a signed-in visitor with a link into the game', async () => {
  const user = createMockUser({ name: 'Demo Account' });
  const rendered = renderWithRouter(<HomeHero user={user} />);

  const welcome = await rendered.findByText('Welcome back, Demo Account.');

  expect(welcome).toBeVisible();
  expect(rendered.getByText('Enter game').closest('a')).toHaveAttribute('href', '/respite');
});
