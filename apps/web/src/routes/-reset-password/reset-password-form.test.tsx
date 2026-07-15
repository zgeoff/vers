import { expect, mock, test } from 'bun:test';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildDeferred } from '../../test-utils/build-deferred';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ResetPasswordForm } from './reset-password-form';

function rejectWithResponse(): Promise<Response> {
  return Promise.resolve(new Response(null, { status: 400 }));
}

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

test('it shows a form-level error message', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(
      <ResetPasswordForm
        email="reset-form@vers.test"
        lastResult={{
          error: { '': ['This reset link is invalid or has expired.'] },
          status: 'error',
        }}
        resetToken="a-token"
      />,
    );

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('This reset link is invalid or has expired.');
  });
});

test('it shows the error for the confirm-password field', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(
      <ResetPasswordForm
        email="reset-form@vers.test"
        lastResult={{ error: { confirmPassword: ['The passwords must match'] }, status: 'error' }}
        resetToken="a-token"
      />,
    );

    const confirmError = await screen.findByText('The passwords must match');

    expect(confirmError).toBeInTheDocument();
  });
});

test('it shows a generic failure message when the server rejects the submission', async () => {
  const user = userEvent.setup();

  await withRequestContext({}, async () => {
    renderWithRouter(
      <ResetPasswordForm
        action={rejectWithResponse}
        email="reset-form-honeypot@vers.test"
        resetToken="tok"
      />,
    );

    const passwordField = await screen.findByLabelText('New Password');

    await user.type(passwordField, 'new-password123');
    await user.type(screen.getByLabelText('Confirm Password'), 'new-password123');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      );
    });
  });
});

test('it disables the submit button while the reset request is pending', async () => {
  const user = userEvent.setup();
  const deferred = buildDeferred<undefined>();
  const gatedAction = mock(() => deferred.promise);

  await withRequestContext({}, async () => {
    renderWithRouter(
      <ResetPasswordForm
        action={gatedAction}
        email="reset-form-pending@vers.test"
        resetToken="tok"
      />,
    );

    const passwordField = await screen.findByLabelText('New Password');

    await user.type(passwordField, 'new-password123');
    await user.type(screen.getByLabelText('Confirm Password'), 'new-password123');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(screen.getByRole('button', { name: 'Reset Password' })).toBeDisabled();

    await deferred.release(undefined);

    expect(screen.getByRole('button', { name: 'Reset Password' })).not.toBeDisabled();
  });
});
