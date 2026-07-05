import { drop } from '@mswjs/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, graphql } from 'msw';
import { createRoutesStub, useSearchParams } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';
import { VerificationType } from '../../gql/graphql';
import { db } from '../../mocks/db';
import { server } from '../../mocks/node';
import { verifySessionStorage } from '../../session/verify-session-storage.server';
import { composeDataFnWrappers } from '../../test-utils/compose-data-fn-wrappers';
import { withAppLoadContext } from '../../test-utils/with-app-load-context';
import { withAuthedUser } from '../../test-utils/with-authed-user';
import { withRouteProps } from '../../test-utils/with-route-props';
import { withSession } from '../../test-utils/with-session';
import { Routes } from '../../types';
import { AccountChangeUserEmail, action, loader } from './route';

interface TestConfig {
  isAuthed?: boolean;
  transactionID?: string;
  transactionToken?: string;
  user?: {
    email?: string;
    id?: string;
    is2FAEnabled?: boolean;
  };
}

let setCookieHeader: null | string = null;

const _Response = globalThis.Response;

// stub the global Response object so we can capture the cookie header
vi.stubGlobal(
  'Response',
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  vi.fn((body?: BodyInit | null, init?: ResponseInit) => {
    if (init?.headers instanceof Headers) {
      setCookieHeader = init.headers.get('set-cookie');
    }

    return new _Response(body, init);
  }),
);

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
function setupTest(config: TestConfig) {
  const user = userEvent.setup();

  const sessionData = {
    'changeEmail#transactionID': config.transactionID,
    'changeEmail#transactionToken': config.transactionToken,
  };

  const _action = composeDataFnWrappers(
    action,
    withAppLoadContext,
    (_) => withSession(_, sessionData),
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
    config.isAuthed && ((_) => withAuthedUser(_, { user: config.user })),
  );

  const _loader = composeDataFnWrappers(
    loader,
    withAppLoadContext,
    (_) => withSession(_, sessionData),
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
    config.isAuthed && ((_) => withAuthedUser(_, { user: config.user })),
  );

  const AccountChangeUserEmailStub = createRoutesStub([
    {
      action: _action,
      Component: withRouteProps(AccountChangeUserEmail),
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
    {
      Component: () => {
        const [searchParams] = useSearchParams();

        return (
          <>
            <h1>VERIFY_OTP_ROUTE</h1>
            <span>{searchParams.toString()}</span>
          </>
        );
      },
      path: Routes.VerifyOTP,
    },
  ]);

  render(<AccountChangeUserEmailStub />);

  return { user };
}

afterEach(() => {
  server.resetHandlers();

  drop(db);

  setCookieHeader = null;
});

test('it redirects to login if the user is not authenticated', async () => {
  setupTest({ isAuthed: false });

  const loginRoute = await screen.findByText('LOGIN_ROUTE');

  expect(loginRoute).toBeInTheDocument();
});

test('it renders the change email form when authenticated without 2FA', async () => {
  setupTest({
    isAuthed: true,
    user: {
      email: 'test@example.com',
      id: 'user_id',
      is2FAEnabled: false,
    },
  });

  await screen.findByRole('heading', { name: 'Change your email address' });

  const emailInput = screen.getByLabelText('New Email Address');
  const submitButton = screen.getByRole('button', { name: 'Change Email' });

  expect(emailInput).toBeInTheDocument();
  expect(submitButton).toBeInTheDocument();
});

test('it redirects to verify 2FA as needed when no transaction token is in the session', async () => {
  setupTest({
    isAuthed: true,
    user: {
      email: 'test@example.com',
      id: 'user_id',
      is2FAEnabled: true,
    },
  });

  const verifyOTPRoute = await screen.findByText('VERIFY_OTP_ROUTE');
  const searchParams = screen.getByText('target=test%40example.com&type=CHANGE_EMAIL');

  expect(searchParams).toBeInTheDocument();
  expect(verifyOTPRoute).toBeInTheDocument();

  const verifySession = await verifySessionStorage.getSession(setCookieHeader);

  const transactionID = verifySession.get('changeEmail#transactionID');

  expect(transactionID).toStrictEqual(expect.any(String));
});

test('it renders the form when 2FA is enabled and a transaction token is in the session', async () => {
  setupTest({
    isAuthed: true,
    transactionToken: 'valid_token',
    user: {
      email: 'test@example.com',
      id: 'user_id',
      is2FAEnabled: true,
    },
  });

  await screen.findByRole('heading', { name: 'Change your email address' });

  const emailInput = screen.getByLabelText('New Email Address');
  const submitButton = screen.getByRole('button', { name: 'Change Email' });

  expect(emailInput).toBeInTheDocument();
  expect(submitButton).toBeInTheDocument();
});

test('it shows validation errors for invalid form submission', async () => {
  const { user } = setupTest({
    isAuthed: true,
    transactionToken: 'valid_token',
    user: {
      email: 'test@example.com',
      id: 'user_id',
      is2FAEnabled: false,
    },
  });

  await screen.findByRole('heading', { name: 'Change your email address' });

  const emailInput = screen.getByLabelText('New Email Address');
  const submitButton = screen.getByRole('button', { name: 'Change Email' });

  await user.type(emailInput, 'invalid-email');
  await user.click(submitButton);

  const errorMessage = await screen.findByText('Email is invalid');

  expect(errorMessage).toBeInTheDocument();
});

test('it handles a successful email change submission', async () => {
  const { user } = setupTest({
    isAuthed: true,
    transactionToken: 'valid_token',
    user: {
      email: 'test@example.com',
      id: 'user_id',
      is2FAEnabled: false,
    },
  });

  await screen.findByRole('heading', { name: 'Change your email address' });

  const emailInput = screen.getByLabelText('New Email Address');
  const submitButton = screen.getByRole('button', { name: 'Change Email' });

  await user.type(emailInput, 'new-email@example.com');
  await user.click(submitButton);

  const verifyOTPRoute = await screen.findByText('VERIFY_OTP_ROUTE');

  const searchParams = screen.getByText(
    `target=new-email%40example.com&type=${VerificationType.ChangeEmailConfirmation}`,
  );

  expect(searchParams).toBeInTheDocument();
  expect(verifyOTPRoute).toBeInTheDocument();

  const verifySession = await verifySessionStorage.getSession(setCookieHeader);

  expect(verifySession.get('changeEmail#transactionID')).toBeUndefined();
  expect(verifySession.get('changeEmailConfirm#transactionID')).toStrictEqual(expect.any(String));
});

test('it shows an error when the email change fails', async () => {
  server.use(
    graphql.mutation('StartChangeUserEmail', () =>
      HttpResponse.json({
        errors: [{ message: 'Email already in use' }],
      }),
    ),
  );

  const { user } = setupTest({
    isAuthed: true,
    transactionToken: 'valid_token',
    user: {
      email: 'test@example.com',
      id: 'user_id',
      is2FAEnabled: false,
    },
  });

  await screen.findByRole('heading', { name: 'Change your email address' });

  const emailInput = screen.getByLabelText('New Email Address');
  const submitButton = screen.getByRole('button', { name: 'Change Email' });

  await user.type(emailInput, 'existing-email@example.com');
  await user.click(submitButton);

  const errorMessage = await screen.findByText('Something went wrong');

  expect(errorMessage).toBeInTheDocument();
});

test('it shows a specific error when the mutation returns an error payload', async () => {
  server.use(
    graphql.mutation('StartChangeUserEmail', () =>
      HttpResponse.json({
        data: {
          startChangeUserEmail: {
            __typename: 'MutationErrorPayload',
            error: {
              message: 'Email already in use',
              title: 'Error',
            },
          },
        },
      }),
    ),
  );

  const { user } = setupTest({
    isAuthed: true,
    transactionToken: 'valid_token',
    user: {
      email: 'test@example.com',
      id: 'user_id',
      is2FAEnabled: false,
    },
  });

  await screen.findByRole('heading', { name: 'Change your email address' });

  const emailInput = screen.getByLabelText('New Email Address');
  const submitButton = screen.getByRole('button', { name: 'Change Email' });

  await user.type(emailInput, 'existing-email@example.com');
  await user.click(submitButton);

  const errorMessage = await screen.findByText('Email already in use');

  expect(errorMessage).toBeInTheDocument();
});
