import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { pickHomeContent } from './pick-home-content';

test('it renders the anon home content for an unauthenticated result', () => {
  render(pickHomeContent({ authenticated: false, reason: 'missing-session' }));

  expect(screen.getByTestId('home-anon')).toHaveTextContent('You are not signed in.');
});

test('it renders the signed-in home content for an authenticated result', () => {
  render(
    pickHomeContent({
      authenticated: true,
      user: {
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        email: 'pick-home-content@vers.test',
        id: 'user_pick_home_content',
        name: 'Pick Home Content',
        seed: 0,
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        username: 'pick-home-content',
      },
    }),
  );

  expect(screen.getByTestId('home-signed-in')).toHaveTextContent(
    'Welcome back, Pick Home Content.',
  );
});
