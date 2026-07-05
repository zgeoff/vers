import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { PasswordChangedEmail } from './password-changed-email';

test('it renders the password changed email with all required elements', () => {
  render(<PasswordChangedEmail email="test@example.com" />);

  const heading = screen.getByRole('heading', {
    name: 'Your password has been changed',
  });
  const emailText = screen.getByText(/test@example\.com/);
  const resetLink = screen.getByRole('link', {
    name: 'here',
  });

  expect(heading).toBeInTheDocument();
  expect(emailText).toBeInTheDocument();
  expect(resetLink).toBeInTheDocument();
  expect(resetLink).toHaveAttribute('href', 'https://versidle.com/forgot-password');
});
