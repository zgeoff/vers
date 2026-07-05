import { drop } from '@mswjs/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { server } from '../../mocks/node';
import { verifySessionStorage } from '../../session/verify-session-storage.server';
import { composeDataFnWrappers } from '../../test-utils/compose-data-fn-wrappers';
import { withAppLoadContext } from '../../test-utils/with-app-load-context';
import { withAuthedUser } from '../../test-utils/with-authed-user';
import { withRouteProps } from '../../test-utils/with-route-props';
import { withSession } from '../../test-utils/with-session';
import { Routes } from '../../types';
import { AccountVerify2FARoute, action, loader } from './route';

interface TestConfig {
  isAuthed?: boolean;
  transactionID?: string;
  user?: {
    email?: string;
    id?: string;
    name?: string;
  };
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
async function setupTest(config: TestConfig = {}) {
  const user = userEvent.setup();

  const verifySession = await verifySessionStorage.getSession();

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (config.transactionID) {
    verifySession.set('enable2FA#transactionID', config.transactionID);
  }

  const _loader = composeDataFnWrappers(
    loader,
    withAppLoadContext,
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
    config.isAuthed && ((_) => withAuthedUser(_, { user: config.user })),
  );

  const _action = composeDataFnWrappers(
    action,
    withAppLoadContext,
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
    config.isAuthed && ((_) => withAuthedUser(_, { user: config.user })),
    (_) => withSession(_, { 'enable2FA#transactionID': config.transactionID }),
  );

  const AccountVerify2FAStub = createRoutesStub([
    {
      action: _action,
      Component: withRouteProps(AccountVerify2FARoute),
      loader: _loader,
      path: '/',
    },
    {
      Component: () => 'ACCOUNT_ROUTE',
      path: Routes.Account,
    },
    {
      Component: () => 'LOGIN_ROUTE',
      path: Routes.Login,
    },
  ]);

  render(<AccountVerify2FAStub />);

  return { user };
}

afterEach(() => {
  server.resetHandlers();

  drop(db);
});

test('it redirects to login if the user is not authenticated', async () => {
  await setupTest({ isAuthed: false });

  const loginRoute = await screen.findByText('LOGIN_ROUTE');

  expect(loginRoute).toBeInTheDocument();
});

test('it redirects to the account page if the user has 2FA enabled', async () => {
  db.verification.create({
    target: 'test@example.com',
    type: '2fa',
  });

  await setupTest({ isAuthed: true, user: { email: 'test@example.com' } });

  const accountRoute = await screen.findByText('ACCOUNT_ROUTE');

  expect(accountRoute).toBeInTheDocument();
});

test('it renders the 2FA setup page with QR code and form', async () => {
  db.verification.create({
    target: 'test@example.com',
    type: '2fa-setup',
  });

  await setupTest({
    isAuthed: true,
    user: {
      email: 'test@example.com',
    },
  });

  const qrCode = await screen.findByAltText('QR code for 2FA');
  const otpURI = screen.getByText(/otpauth:\/\/totp\/vers:test@example.com/);
  const codeInput = screen.getByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: 'Submit' });

  expect(qrCode).toBeInTheDocument();
  expect(otpURI).toBeInTheDocument();
  expect(codeInput).toBeInTheDocument();
  expect(submitButton).toBeInTheDocument();
});

test('it redirects to the account page on successful 2FA setup', async () => {
  const { user } = await setupTest({
    isAuthed: true,
    transactionID: 'test-transaction-id',
    user: {
      email: 'test@example.com',
    },
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa-setup',
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: 'Submit' });

  await user.type(codeInput, '999999');
  await user.click(submitButton);

  const accountRoute = await screen.findByText('ACCOUNT_ROUTE');

  expect(accountRoute).toBeInTheDocument();
});

test('it shows validation errors for invalid code', async () => {
  const { user } = await setupTest({
    isAuthed: true,
    transactionID: 'test-transaction-id',
    user: {
      email: 'test@example.com',
    },
  });

  // we still need a verification record for the route to load
  db.verification.create({
    target: 'test@example.com',
    type: '2fa-setup',
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: 'Submit' });

  await user.type(codeInput, '12345');
  await user.click(submitButton);

  const errorMessage = await screen.findByText('Invalid code');

  expect(errorMessage).toBeInTheDocument();
});

test('it shows an error message when verification fails', async () => {
  const { user } = await setupTest({
    isAuthed: true,
    transactionID: 'test-transaction-id',
    user: {
      email: 'test@example.com',
    },
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa-setup',
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: 'Submit' });

  await user.type(codeInput, '123456');
  await user.click(submitButton);

  const errorMessage = await screen.findByText('Invalid verification code');

  expect(errorMessage).toBeInTheDocument();
});
