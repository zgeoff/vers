import { drop } from '@mswjs/data';
import { render, screen } from '@testing-library/react';
import { createRoutesStub, useSearchParams } from 'react-router';
import type { LoaderFunction } from 'react-router';
import { afterEach, expect, test } from 'vitest';
import { db } from '~/mocks/db';
import { authSessionStorage } from '~/session/auth-session-storage.server';
import { Routes } from '~/types';
import { requireAuth } from './require-auth.server';

interface TestConfig {
  accessToken?: string;
  initialPath?: string;
  redirectTo?: string;
  refreshToken?: string;
  sessionID?: string;
}

async function setupTest(config: Partial<TestConfig> = {}) {
  const session = await authSessionStorage.getSession();

  if (config.sessionID) {
    session.set('sessionID', config.sessionID);
  }

  if (config.accessToken) {
    session.set('accessToken', config.accessToken);
  }

  if (config.refreshToken) {
    session.set('refreshToken', config.refreshToken);
  }

  const cookieHeader = await authSessionStorage.commitSession(session);

  const loader: LoaderFunction = async (args) => {
    args.request.headers.set('cookie', cookieHeader);

    await requireAuth(args.request);
  };

  const TestRoutesStub = createRoutesStub([
    {
      Component: () => 'TEST_ROUTE',
      loader,
      path: '/',
    },
    {
      Component: () => 'CUSTOM_ROUTE',
      loader,
      path: '/custom-path',
    },
    {
      Component: () => {
        const [params] = useSearchParams();

        const redirect = params.get('redirect');

        return (
          <>
            <h1>LOGIN_ROUTE</h1>
            <div>{redirect}</div>
          </>
        );
      },
      path: Routes.Login,
    },
  ]);

  render(<TestRoutesStub initialEntries={[config.initialPath ?? '/']} />);
}

afterEach(() => {
  drop(db);
});

test('it allows access with valid session', async () => {
  await setupTest({
    accessToken: 'valid_access_token',
    refreshToken: 'valid_refresh_token',
    sessionID: 'test_session_id',
  });

  const testRoute = await screen.findByText('TEST_ROUTE');

  expect(testRoute).toBeInTheDocument();
});

test('it redirects to login when no session exists', async () => {
  await setupTest();

  const loginRoute = await screen.findByText('LOGIN_ROUTE');

  expect(loginRoute).toBeInTheDocument();
});

test('it redirects to login with the current URL as the redirect', async () => {
  await setupTest({ initialPath: '/custom-path?foo=foo' });

  const loginRoute = await screen.findByText('LOGIN_ROUTE');
  const redirect = screen.getByText('/custom-path?foo=foo');

  expect(loginRoute).toBeInTheDocument();
  expect(redirect).toBeInTheDocument();
});
