import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ChangeEmailVerificationEmail } from './change-email-verification';

test('it renders a verification email with provided configuration', () => {
  const props = {
    newEmail: 'new-email@example.com',
    verificationCode: '123456',
    verificationURL: 'https://example.com/verify?code=123456',
  };

  render(<ChangeEmailVerificationEmail {...props} />);

  const heading = screen.getByText('Verify your new email address');
  const emailText = screen.getByText(/new-email@example.com/);
  const codeText = screen.getByText(/123456/);

  const verifyLink = screen.getByRole('link', {
    name: 'Verify email address',
  });

  expect(heading).toBeInTheDocument();
  expect(emailText).toBeInTheDocument();
  expect(codeText).toBeInTheDocument();
  expect(verifyLink).toBeInTheDocument();
  expect(verifyLink).toHaveAttribute('href', props.verificationURL);
});
