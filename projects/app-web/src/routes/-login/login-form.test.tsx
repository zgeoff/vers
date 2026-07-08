import { expect, test } from 'bun:test';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildContractMock } from '@vers/client-test-utils/rpc-msw';
import { userContract } from '@vers/contract-user';
import { SERVICE_URLS } from '../../lib/rpc/service-urls';
import { userCollection } from '../../mocks/db';
import { server } from '../../mocks/node';
import { assertEventually } from '../../test-utils/assert-eventually';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { LoginForm } from './login-form';

test('it shows a generic failure message for a rejected submission', async () => {
  const user = userEvent.setup();

  await withRequestContext({}, async () => {
    renderWithRouter(<LoginForm />);

    const emailField = await screen.findByLabelText('Email');

    await user.type(emailField, 'login-form-honeypot@vers.test');
    await user.type(screen.getByLabelText('Password'), 'password123');

    const honeypotField = document.querySelector<HTMLInputElement>('#name__confirm');

    if (honeypotField === null) {
      throw new Error('expected the honeypot field to be present');
    }

    await user.type(honeypotField, 'filled in by a bot');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      );
    });

    expect(screen.getByRole('button', { name: 'Login' })).not.toBeDisabled();
  });
});

test('it disables the submit button while the login request is pending', async () => {
  const user = userEvent.setup();

  const foundUser = await userCollection.create({
    email: 'login-form-pending@vers.test',
    password: 'password123',
  });

  const mockUser = buildContractMock({
    baseUrl: SERVICE_URLS.user,
    contract: userContract,
    resolveContext: () => ({ actingUserId: null }),
  });

  const lookupGate = Promise.withResolvers<void>();

  server.use(
    mockUser.getUser.handler(async () => {
      await lookupGate.promise;

      return foundUser;
    }),
  );

  await withRequestContext({}, async () => {
    renderWithRouter(<LoginForm />);

    const emailField = await screen.findByLabelText('Email');

    await user.type(emailField, 'login-form-pending@vers.test');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled();
    });

    lookupGate.resolve();

    // the re-enable lands only after the thrown redirect's navigation settles, which act-wrapped
    // waitFor cannot observe here
    await assertEventually(() => {
      if (screen.getByRole('button', { name: 'Login' }).hasAttribute('disabled')) {
        throw new Error('the login button is still disabled');
      }
    });
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
