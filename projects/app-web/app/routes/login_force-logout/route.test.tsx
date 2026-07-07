import { drop } from '@mswjs/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';
import { db } from '../../mocks/db';
import { server } from '../../mocks/node';
import { verifySessionStorage } from '../../session/verify-session-storage.server';
import type { SessionData } from '../../session/verify-session-storage.server';
import { composeDataFnWrappers } from '../../test-utils/compose-data-fn-wrappers';
import { withAppLoadContext } from '../../test-utils/with-app-load-context';
import { withAuthedUser } from '../../test-utils/with-authed-user';
import { withSession } from '../../test-utils/with-session';
import { Routes } from '../../types';
import { LoginForceLogout, action, loader } from './route';

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

interface TestConfig {
  isAuthed: boolean;
  sessionData?: Partial<SessionData>;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
function setupTest(config: TestConfig) {
  const user = userEvent.setup();

  const _action = composeDataFnWrappers(
    action,
    withAppLoadContext,
    config.sessionData && ((_) => withSession(_, config.sessionData ?? {})),
    config.isAuthed && withAuthedUser,
  );

  const _loader = composeDataFnWrappers(
    loader,
    withAppLoadContext,
    config.sessionData && ((_) => withSession(_, config.sessionData ?? {})),
    config.isAuthed && withAuthedUser,
  );

  const LoginStub = createRoutesStub([
    {
      action: _action,
      Component: LoginForceLogout,
      loader: _loader,
      path: Routes.LoginForceLogout,
    },
    {
      Component: () => 'NEXUS_ROUTE',
      path: Routes.Nexus,
    },
    {
      Component: () => 'LOGIN_ROUTE',
      path: Routes.Login,
    },
    {
      Component: () => 'INDEX_ROUTE',
      path: Routes.Index,
    },
  ]);

  render(<LoginStub initialEntries={[Routes.LoginForceLogout]} />);

  return { user };
}

afterEach(() => {
  server.resetHandlers();

  drop(db);

  setCookieHeader = null;
});

test('it redirects to the nexus if the user is authed', async () => {
  setupTest({ isAuthed: true });

  const nexusRoute = await screen.findByText('NEXUS_ROUTE');

  expect(nexusRoute).toBeInTheDocument();
});

test('it redirects to the login page if the session is missing', async () => {
  setupTest({ isAuthed: false, sessionData: {} });

  const loginRoute = await screen.findByText('LOGIN_ROUTE');

  expect(loginRoute).toBeInTheDocument();
});

test("it renders a confirmation dialog to forcefully logout the user's previous sessions", async () => {
  setupTest({
    isAuthed: false,
    sessionData: {
      'loginLogout#email': 'test@test.com',
      'loginLogout#transactionToken': 'valid_transaction_token',
    },
  });

  const heading = await screen.findByRole('heading', {
    name: 'You are logged in elsewhere',
  });

  const confirmButton = screen.getByRole('button', { name: 'Confirm' });
  const cancelButton = screen.getByRole('button', { name: 'Cancel' });

  expect(heading).toBeInTheDocument();
  expect(confirmButton).toBeInTheDocument();
  expect(cancelButton).toBeInTheDocument();
});

test('it logs the user in and redirects to the nexus if the user confirms the dialog', async () => {
  db.user.create({
    email: 'test@test.com',
    id: 'user_id',
  });

  db.session.create({
    userID: 'user_id',
  });

  const ctx = setupTest({
    isAuthed: false,
    sessionData: {
      'loginLogout#email': 'test@test.com',
      'loginLogout#transactionToken': 'valid_transaction_token',
    },
  });

  const confirmButton = await screen.findByRole('button', { name: 'Confirm' });

  await ctx.user.click(confirmButton);

  const nexusRoute = await screen.findByText('NEXUS_ROUTE');

  expect(nexusRoute).toBeInTheDocument();

  const verifySession = await verifySessionStorage.getSession(setCookieHeader);

  expect(verifySession.get('loginLogout#email')).toBeUndefined();
  expect(verifySession.get('loginLogout#transactionToken')).toBeUndefined();
});

test('it cancels the force logout flow if the user clicks the cancel button', async () => {
  db.user.create({
    email: 'test@test.com',
  });

  const ctx = setupTest({
    isAuthed: false,
    sessionData: {
      'loginLogout#email': 'test@test.com',
      'loginLogout#transactionToken': 'valid_transaction_token',
    },
  });

  const cancelButton = await screen.findByRole('button', { name: 'Cancel' });

  await ctx.user.click(cancelButton);

  const indexRoute = await screen.findByText('INDEX_ROUTE');

  expect(indexRoute).toBeInTheDocument();

  const verifySession = await verifySessionStorage.getSession(setCookieHeader);

  expect(verifySession.get('loginLogout#email')).toBeUndefined();
  expect(verifySession.get('loginLogout#transactionToken')).toBeUndefined();
});
