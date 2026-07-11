import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import * as db from '../../mocks/db';
import { AccountContent } from './account-content';

test('it shows the caller profile and a not-enabled 2FA status', async () => {
  const user = await db.userCollection.create({
    email: 'account-content@vers.test',
    username: 'account-content',
  });

  render(<AccountContent has2FA={false} user={user} />);
  expect(screen.getByTestId('account-username')).toHaveTextContent('Username: account-content');
  expect(screen.getByTestId('account-email')).toHaveTextContent('Email: account-content@vers.test');

  expect(screen.getByTestId('account-2fa-status')).toHaveTextContent(
    'Two-factor authentication is not enabled.',
  );
});

test('it shows an enabled 2FA status', async () => {
  const user = await db.userCollection.create({});

  render(<AccountContent has2FA user={user} />);

  expect(screen.getByTestId('account-2fa-status')).toHaveTextContent(
    'Two-factor authentication is enabled.',
  );
});
