import { drop } from '@mswjs/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphQLError } from 'graphql';
import { graphql } from 'msw';
import { createRoutesStub } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';
import { db } from '~/mocks/db';
import { server } from '~/mocks/node';
import { verifySessionStorage } from '~/session/verify-session-storage.server';
import { composeDataFnWrappers } from '~/test-utils/compose-data-fn-wrappers';
import { withAppLoadContext } from '~/test-utils/with-app-load-context';
import { withAuthedUser } from '~/test-utils/with-authed-user';
import { withRouteProps } from '~/test-utils/with-route-props';
import { Routes } from '~/types';
import { Signup, action, loader } from './route';

let cookieHeader: null | string = null;

const _Response = globalThis.Response;

// stub the global Response object so we can capture the cookie header
vi.stubGlobal(
  'Response',
  vi.fn((body?: BodyInit | null, init?: ResponseInit) => {
    if (init?.headers instanceof Headers) {
      cookieHeader = init.headers.get('set-cookie');
    }

    return new _Response(body, init);
  }),
);

interface TestConfig {
  isAuthed: boolean;
}

function setupTest(config: TestConfig) {
  const user = userEvent.setup();

  const _loader = composeDataFnWrappers(
    loader,
    withAppLoadContext,
    config.isAuthed && withAuthedUser,
  );

  const _action = composeDataFnWrappers(
    action,
    withAppLoadContext,
    config.isAuthed && withAuthedUser,
  );

  const SignupStub = createRoutesStub([
    {
      action: _action,
      Component: withRouteProps(Signup),
      loader: _loader,
      path: '/',
    },
    {
      Component: () => 'VERIFY_OTP_ROUTE',
      path: Routes.VerifyOTP,
    },
    {
      Component: () => 'NEXUS_ROUTE',
      path: Routes.Nexus,
    },
  ]);

  render(<SignupStub />);

  return { user };
}

afterEach(() => {
  server.resetHandlers();

  drop(db);
});

test('it renders the signup form with accessible elements', async () => {
  setupTest({ isAuthed: false });

  const emailInput = await screen.findByRole('textbox', { name: /email/i });
  const submitButton = screen.getByRole('button', { name: /signup/i });

  expect(emailInput).toBeInTheDocument();
  expect(submitButton).toBeInTheDocument();
});

test('it shows validation error for invalid email', async () => {
  const { user } = setupTest({ isAuthed: false });

  const emailInput = await screen.findByRole('textbox', { name: /email/i });
  const submitButton = screen.getByRole('button', { name: /signup/i });

  await user.type(emailInput, 'invalid-email');
  await user.click(submitButton);

  const errorMessage = await screen.findByText('Email is invalid');

  expect(errorMessage).toBeInTheDocument();
});

test('it shows validation error when email is missing', async () => {
  const { user } = setupTest({ isAuthed: false });

  const submitButton = await screen.findByRole('button', { name: /signup/i });

  await user.click(submitButton);

  const errorMessage = await screen.findByText('Email is required');

  expect(errorMessage).toBeInTheDocument();
});

test('it redirects to verify OTP page on successful signup', async () => {
  const { user } = setupTest({ isAuthed: false });

  const emailInput = await screen.findByRole('textbox', { name: /email/i });
  const submitButton = screen.getByRole('button', { name: /signup/i });

  await user.type(emailInput, 'test@example.com');
  await user.click(submitButton);

  const verifyOTPRoute = await screen.findByText('VERIFY_OTP_ROUTE');

  expect(verifyOTPRoute).toBeInTheDocument();

  const verifySession = await verifySessionStorage.getSession(cookieHeader);

  expect(verifySession.get('onboarding#transactionID')).toBe('valid-transaction-id');
});

test('it shows a generic error if the mutation fails', async () => {
  server.use(
    graphql.mutation('StartEmailSignup', () => {
      throw new GraphQLError('Something went wrong');
    }),
  );

  const { user } = setupTest({ isAuthed: false });

  const emailInput = await screen.findByRole('textbox', { name: /email/i });
  const submitButton = screen.getByRole('button', { name: /signup/i });

  await user.type(emailInput, 'test@example.com');
  await user.click(submitButton);

  const errorMessage = await screen.findByText('Something went wrong');

  expect(errorMessage).toBeInTheDocument();
});

test('it redirects to the nexus route when already authenticated', async () => {
  setupTest({ isAuthed: true });

  const nexusRoute = await screen.findByText('NEXUS_ROUTE');

  expect(nexusRoute).toBeInTheDocument();
});
