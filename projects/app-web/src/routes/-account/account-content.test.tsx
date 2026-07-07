import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { AccountContent } from './account-content';

const user = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  email: 'account-content@vers.test',
  id: 'user_account_content',
  name: 'Account Content',
  seed: 0,
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  username: 'account-content',
};

test('it shows the caller profile and a not-enabled 2FA status', () => {
  render(<AccountContent has2FA={false} user={user} />);

  expect(screen.getByTestId('account-username')).toHaveTextContent('Username: account-content');
  expect(screen.getByTestId('account-email')).toHaveTextContent('Email: account-content@vers.test');

  expect(screen.getByTestId('account-2fa-status')).toHaveTextContent(
    'Two-factor authentication is not enabled.',
  );
});

test('it shows an enabled 2FA status', () => {
  render(<AccountContent has2FA user={user} />);

  expect(screen.getByTestId('account-2fa-status')).toHaveTextContent(
    'Two-factor authentication is enabled.',
  );
});
