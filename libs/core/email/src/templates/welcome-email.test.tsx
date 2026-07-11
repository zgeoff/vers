import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { WelcomeEmail } from './welcome-email';

test('it renders a welcome email with provided configuration', () => {
  const props = {
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verification?token=123456',
  };

  render(<WelcomeEmail {...props} />);

  const welcomeMessage = screen.getByText('Welcome to vers');
  const verificationCode = screen.getByText('123456');

  const verificationLink = screen.getByRole('link', {
    name: 'Verify your account',
  });

  expect(welcomeMessage).toBeInTheDocument();
  expect(verificationCode).toBeInTheDocument();
  expect(verificationLink).toBeInTheDocument();
});
