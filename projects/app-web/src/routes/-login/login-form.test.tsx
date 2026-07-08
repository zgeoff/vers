import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildContractMock } from '@vers/client-test-utils/rpc-msw';
import { userContract } from '@vers/contract-user';
import { SERVICE_URLS } from '../../lib/rpc/service-urls';
import { userCollection } from '../../mocks/db/user-collection';
import { server } from '../../mocks/node';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { LoginForm } from './login-form';

/**
 * `login-handler.test.ts` drives every `LoginResult` branch (field errors, invalid credentials,
 * 2FA, force-logout, success) against the handler body directly. The two branches that return a
 * plain result object instead of throwing a redirect or returning a `Response` can't be observed
 * here: an uncompiled `createServerFn` export (what `bun test` runs, with no compiler pass to swap
 * in the real client/server split) only relays a `Response` or a thrown error/redirect back to its
 * caller, so this file covers the branches that round-trip that way and leaves the rest to the
 * handler-level tests plus the real-runtime smoke suite.
 */
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
    createdAt: new Date(),
    email: 'login-form-pending@vers.test',
    id: createId(),
    name: 'Login Form Pending',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: 'login-form-pending',
  });

  const mockUser = buildContractMock({
    baseUrl: SERVICE_URLS.user,
    contract: userContract,
    resolveContext: () => ({ actingUserId: null }),
  });

  server.use(
    mockUser.getUser.handler(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      return foundUser;
    }),
  );

  await withRequestContext({}, async () => {
    renderWithRouter(<LoginForm />);

    const emailField = await screen.findByLabelText('Email');

    await user.type(emailField, 'login-form-pending@vers.test');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled();

    // a completed submission here ends in `useServerFn` catching a thrown redirect and calling
    // `router.navigate` itself, which `waitFor`'s `act()` wrapping never observes settling — a
    // plain delay is used instead
    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });

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
