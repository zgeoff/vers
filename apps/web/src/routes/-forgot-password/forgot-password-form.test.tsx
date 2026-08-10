import { expect, mock, test } from 'bun:test';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildDeferred } from '../../test-utils/build-deferred';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ForgotPasswordForm } from './forgot-password-form';

function rejectWithResponse(): Promise<Response> {
  return Promise.resolve(new Response(null, { status: 400 }));
}

test('it shows the error for the email field', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(
      <ForgotPasswordForm
        honeypotValidFrom="1700000000000"
        lastResult={{ error: { email: ['Email is invalid'] }, status: 'error' }}
      />,
    );

    const emailError = await screen.findByText('Email is invalid');

    expect(emailError).toBeInTheDocument();
  });
});

test('it shows a generic failure message when the server rejects the submission', async () => {
  const user = userEvent.setup();

  await withRequestContext({}, async () => {
    renderWithRouter(
      <ForgotPasswordForm action={rejectWithResponse} honeypotValidFrom="1700000000000" />,
    );

    const emailInput = await screen.findByLabelText('Email');

    await user.type(emailInput, 'player@vers.test');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('Something went wrong. Please try again.');
  });
});

test('it disables the submit button while the request is pending', async () => {
  const user = userEvent.setup();
  const deferred = buildDeferred<undefined>();
  const gatedAction = mock(() => deferred.promise);

  await withRequestContext({}, async () => {
    renderWithRouter(<ForgotPasswordForm action={gatedAction} honeypotValidFrom="1700000000000" />);

    const emailInput = await screen.findByLabelText('Email');

    await user.type(emailInput, 'player@vers.test');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    expect(screen.getByRole('button', { name: 'Reset Password' })).toBeDisabled();

    await deferred.release(undefined);

    expect(screen.getByRole('button', { name: 'Reset Password' })).not.toBeDisabled();
  });
});
