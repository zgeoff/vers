import { expect, test } from 'bun:test';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormAction } from '../../lib/forms/types';
import { buildDeferred } from '../../test-utils/build-deferred';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { VerifyOTPForm } from './verify-otp-form';

function rejectWithResponse(): Promise<Response> {
  return Promise.resolve(new Response(null, { status: 400 }));
}

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

test('it shows a form-level error on the code field', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(
      <VerifyOTPForm
        lastResult={{ error: { '': ['Invalid or expired code'] }, status: 'error' }}
        target="user_1"
        type="2fa"
      />,
    );

    const codeError = await screen.findByText('Invalid or expired code');

    expect(codeError).toBeInTheDocument();
  });
});

test('it shows a generic failure message for a rejected submission', async () => {
  const user = userEvent.setup();

  await withRequestContext({}, async () => {
    renderWithRouter(<VerifyOTPForm action={rejectWithResponse} target="user_1" type="2fa" />);

    const otpInput = await screen.findByTestId('otp-input');

    await user.click(otpInput);
    await user.keyboard('123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeVisible();
    });
  });
});

test('it disables the submit button while the verify request is pending', async () => {
  const user = userEvent.setup();
  const deferred = buildDeferred<undefined>();
  const fakeGatedAction: FormAction = () => deferred.promise;

  await withRequestContext({}, async () => {
    renderWithRouter(<VerifyOTPForm action={fakeGatedAction} target="user_1" type="2fa" />);

    const otpInput = await screen.findByTestId('otp-input');

    await user.click(otpInput);
    await user.keyboard('123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();

    await deferred.release(undefined);

    expect(screen.getByRole('button', { name: 'Verify' })).not.toBeDisabled();
  });
});
