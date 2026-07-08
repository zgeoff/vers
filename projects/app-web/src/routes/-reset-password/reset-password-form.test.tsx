import { expect, test } from 'bun:test';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ResetPasswordForm } from './reset-password-form';

test('it renders the hidden email and reset-token fields', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<ResetPasswordForm email="reset-form@vers.test" resetToken="a-token" />);

    const emailField = await waitFor(() => {
      const field = document.querySelector<HTMLInputElement>('input[name="email"]');

      if (field === null) {
        throw new Error('expected the hidden email input to be present');
      }

      return field;
    });

    expect(emailField.value).toBe('reset-form@vers.test');

    const resetTokenField = document.querySelector<HTMLInputElement>('input[name="resetToken"]');

    expect(resetTokenField?.value).toBe('a-token');
  });
});

test('it shows a generic failure message for a rejected submission', async () => {
  const user = userEvent.setup();

  await withRequestContext({}, async () => {
    renderWithRouter(<ResetPasswordForm email="reset-form-honeypot@vers.test" resetToken="tok" />);

    const passwordField = await screen.findByLabelText('New Password');

    await user.type(passwordField, 'new-password123');
    await user.type(screen.getByLabelText('Confirm Password'), 'new-password123');

    const honeypotField = document.querySelector<HTMLInputElement>('#name__confirm');

    if (honeypotField === null) {
      throw new Error('expected the honeypot field to be present');
    }

    await user.type(honeypotField, 'filled in by a bot');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      );
    });
  });
});
