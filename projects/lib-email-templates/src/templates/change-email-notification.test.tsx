import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ChangeEmailNotificationEmail } from './change-email-notification';

test('it renders a notification email with the correct content', () => {
  render(<ChangeEmailNotificationEmail />);

  const heading = screen.getByText('Your email address has been changed');
  const contactLink = screen.getByRole('link', {
    name: 'contact support',
  });

  expect(heading).toBeInTheDocument();
  expect(contactLink).toBeInTheDocument();
  expect(contactLink).toHaveAttribute('href', 'https://versidle.com/contact');
});
