import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { HomeContent } from './home-content';

test('it shows the signed-out message when there is no active session', () => {
  render(<HomeContent result={{ authenticated: false, reason: 'missing-session' }} />);
  expect(screen.getByTestId('home-anon')).toHaveTextContent('You are not signed in.');
});

test('it shows the signed-out message when the session read fails', () => {
  render(<HomeContent result={{ authenticated: false, reason: 'transport-error' }} />);
  expect(screen.getByTestId('home-anon')).toHaveTextContent('You are not signed in.');
});

test('it welcomes the signed-in user by name', () => {
  render(
    <HomeContent
      result={{
        authenticated: true,
        user: {
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          email: 'home-content@vers.test',
          id: 'user_home_content',
          name: 'Home Content',
          seed: 0,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          username: 'home-content',
        },
      }}
    />,
  );

  expect(screen.getByTestId('home-signed-in')).toHaveTextContent('Welcome back, Home Content.');
});
