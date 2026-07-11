import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { TwoFactorEmail } from './two-factor-email';

test('it renders a two-factor email with the provided configuration', () => {
  const props = {
    verificationCode: '123456',
  };

  render(<TwoFactorEmail {...props} />);

  const heading = screen.getByText('Your two-factor sign-in code');
  const codeText = screen.getByText(/123456/);
  const resetLink = screen.getByRole('link', { name: 'here' });

  expect(heading).toBeInTheDocument();
  expect(codeText).toBeInTheDocument();
  expect(resetLink).toBeInTheDocument();
  expect(resetLink).toHaveAttribute('href', 'https://versidle.com/forgot-password');
});
