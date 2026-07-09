import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { ExistingAccountEmail } from './existing-account-email';

test('it renders the existing account email with all required elements', () => {
  render(<ExistingAccountEmail email="test@example.com" />);

  const heading = screen.getByRole('heading', {
    name: 'You already have an account',
  });

  const emailText = screen.getByText(/test@example\.com/i);
  const resetLink = screen.getByRole('link', { name: /reset password/i });

  expect(heading).toBeInTheDocument();
  expect(emailText).toBeInTheDocument();
  expect(resetLink).toBeInTheDocument();
  expect(resetLink).toHaveAttribute('href', 'https://versidle.com/forgot-password');
});
