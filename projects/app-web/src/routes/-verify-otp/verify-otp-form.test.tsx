import { expect, test } from 'bun:test';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { VerifyOTPForm } from './verify-otp-form';

test('it shows the 2FA heading and instructions for a login verification', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<VerifyOTPForm target="user_1" type="2fa" />);

    const heading = await screen.findByText('Two-factor authentication');

    expect(heading).toBeVisible();

    expect(
      screen.getByText('To log in, please enter the six digit code from your authenticator app'),
    ).toBeVisible();
  });
});

test('it shows the check-your-email heading and instructions for onboarding', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<VerifyOTPForm target="new-user@vers.test" type="onboarding" />);

    const heading = await screen.findByText('Check your email');

    expect(heading).toBeVisible();

    expect(
      screen.getByText(
        "To complete your account creation, please enter the six digit code we've sent to your email",
      ),
    ).toBeVisible();
  });
});

test('it shows a generic failure message for a rejected submission', async () => {
  const user = userEvent.setup();

  await withRequestContext({}, async () => {
    renderWithRouter(<VerifyOTPForm target="user_1" type="2fa" />);

    const honeypotField = await waitFor(() => {
      const field = document.querySelector<HTMLInputElement>('#name__confirm');

      if (field === null) {
        throw new Error('expected the honeypot field to be present');
      }

      return field;
    });

    await user.type(honeypotField, 'filled in by a bot');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeVisible();
    });
  });
});
