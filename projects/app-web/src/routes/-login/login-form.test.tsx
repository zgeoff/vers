import { expect, test } from 'bun:test';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormAction } from '../../lib/forms/types';
import { buildDeferred } from '../../test-utils/build-deferred';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { LoginForm } from './login-form';

function rejectWithResponse(): Promise<Response> {
  return Promise.resolve(new Response(null, { status: 400 }));
}

test('it shows a form-level error message', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(
      <LoginForm lastResult={{ error: { '': ['Invalid email or password'] }, status: 'error' }} />,
    );

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('Invalid email or password');
  });
});

test('it shows the error for each invalid field', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(
      <LoginForm
        lastResult={{
          error: { email: ['Email is invalid'], password: ['Password must be 8+ characters'] },
          status: 'error',
        }}
      />,
    );

    const emailError = await screen.findByText('Email is invalid');

    expect(emailError).toBeInTheDocument();
    expect(screen.getByText('Password must be 8+ characters')).toBeInTheDocument();
  });
});

test('it shows a generic failure message when the server rejects the submission', async () => {
  const user = userEvent.setup();

  await withRequestContext({}, async () => {
    renderWithRouter(<LoginForm action={rejectWithResponse} />);

    const emailInput = await screen.findByLabelText('Email');

    await user.type(emailInput, 'player@vers.test');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      );
    });
  });
});

test('it disables the submit button while the login request is pending', async () => {
  const user = userEvent.setup();
  const deferred = buildDeferred<undefined>();
  const gatedAction: FormAction = () => deferred.promise;

  await withRequestContext({}, async () => {
    renderWithRouter(<LoginForm action={gatedAction} />);

    const emailInput = await screen.findByLabelText('Email');

    await user.type(emailInput, 'player@vers.test');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled();

    await deferred.release(undefined);

    expect(screen.getByRole('button', { name: 'Login' })).not.toBeDisabled();
  });
});

test('it renders the redirect target as a hidden field', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<LoginForm redirectTo="/nexus" />);

    const hiddenInput = await waitFor(() => {
      const input = document.querySelector<HTMLInputElement>('input[name="redirectTo"]');

      if (input === null) {
        throw new Error('expected the hidden redirectTo input to be present');
      }

      return input;
    });

    expect(hiddenInput.value).toBe('/nexus');
  });
});
