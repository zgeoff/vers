import { expect, test } from 'bun:test';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormAction } from '../../lib/forms/types';
import { buildDeferred } from '../../test-utils/build-deferred';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { SignupForm } from './signup-form';

function rejectWithResponse(): Promise<Response> {
  return Promise.resolve(new Response(null, { status: 400 }));
}

test('it shows the error for the email field', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(
      <SignupForm lastResult={{ error: { email: ['Email is invalid'] }, status: 'error' }} />,
    );

    const emailError = await screen.findByText('Email is invalid');

    expect(emailError).toBeInTheDocument();
  });
});

test('it shows a generic failure message when the server rejects the submission', async () => {
  const user = userEvent.setup();

  await withRequestContext({}, async () => {
    renderWithRouter(<SignupForm action={rejectWithResponse} />);

    const emailInput = await screen.findByLabelText('Email');

    await user.type(emailInput, 'player@vers.test');
    await user.click(screen.getByRole('button', { name: 'Signup' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      );
    });
  });
});

test('it disables the submit button while the signup request is pending', async () => {
  const user = userEvent.setup();
  const deferred = buildDeferred<undefined>();
  const gatedAction: FormAction = () => deferred.promise;

  await withRequestContext({}, async () => {
    renderWithRouter(<SignupForm action={gatedAction} />);

    const emailInput = await screen.findByLabelText('Email');

    await user.type(emailInput, 'player@vers.test');
    await user.click(screen.getByRole('button', { name: 'Signup' }));

    expect(screen.getByRole('button', { name: 'Signup' })).toBeDisabled();

    await deferred.release(undefined);

    expect(screen.getByRole('button', { name: 'Signup' })).not.toBeDisabled();
  });
});
