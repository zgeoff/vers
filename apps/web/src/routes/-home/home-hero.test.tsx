import { expect, test } from 'bun:test';
import { act, screen } from '@testing-library/react';
import { createMockUser } from '../../test-utils/factories/create-mock-user';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { HomeHero } from './home-hero';

test('it invites an anonymous visitor to log in or sign up', async () => {
  const rendered = renderWithRouter(<HomeHero user={null} />);

  await act(() => rendered.router.load());

  expect(screen.getByText('Log in').closest('a')).toHaveAttribute('href', '/login');
  expect(screen.getByText('Sign up').closest('a')).toHaveAttribute('href', '/signup');
});

test('it welcomes a signed-in visitor with a link into the game', async () => {
  const user = createMockUser({ name: 'Demo Account' });
  const rendered = renderWithRouter(<HomeHero user={user} />);

  await act(() => rendered.router.load());

  expect(screen.getByText('Welcome back, Demo Account.')).toBeVisible();
  expect(screen.getByText('Enter game').closest('a')).toHaveAttribute('href', '/respite');
});
