import { afterEach, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRoutesStub, type LoaderFunction } from 'react-router';
import { drop } from '@mswjs/data';
import { graphql, HttpResponse } from 'msw';
import { db } from '~/mocks/db';
import { server } from '~/mocks/node';
import { withRouteProps } from '~/test-utils/with-route-props';
import { Routes } from '~/types';
import { createGQLClient } from './create-gql-client.server';
import { refreshAccessToken } from './refresh-access-token.server';

const loader: LoaderFunction = async ({ request }) => {
  const client = await createGQLClient(request);

  const tokenPayload = await refreshAccessToken(request, {
    refreshToken: 'valid-refresh-token',
    utils: {
      appendHeaders: (operation) => {
        return operation;
      },
      mutate: async (...args) => {
        return client.mutation(...args);
      },
    },
  });

  return tokenPayload;
};

function setupTest() {
  const TestRoutesStub = createRoutesStub([
    {
      Component: withRouteProps(({ loaderData }) => (
        <>
          <h1>TEST_ROUTE</h1>
          <span>{JSON.stringify(loaderData, null, 2)}</span>
        </>
      )),
      loader,
      path: '/',
    },
    {
      Component: () => 'LOGIN_ROUTE',
      path: Routes.Login,
    },
  ]);

  render(<TestRoutesStub />);
}

afterEach(() => {
  drop(db);
});

test('it refreshes the access token', async () => {
  server.use(
    graphql.mutation('RefreshAccessToken', () =>
      HttpResponse.json({
        data: {
          refreshAccessToken: {
            accessToken: 'new-access-token',
            refreshToken: 'valid-refresh-token',
          },
        },
      }),
    ),
  );

  setupTest();

  const testRoute = await screen.findByText('TEST_ROUTE');
  const refreshToken = screen.getByText(/valid-refresh-token/);
  const accessToken = screen.getByText(/new-access-token/);

  expect(testRoute).toBeInTheDocument();
  expect(accessToken).toBeInTheDocument();
  expect(refreshToken).toBeInTheDocument();
});

test('it redirects to login with the current URL as the redirect on mutation error', async () => {
  server.use(
    graphql.mutation('RefreshAccessToken', () =>
      HttpResponse.json({
        data: {
          refreshAccessToken: {
            error: {
              message: 'test error',
              title: '',
            },
          },
        },
      }),
    ),
  );

  setupTest();

  const testRoute = await screen.findByText('LOGIN_ROUTE');

  expect(testRoute).toBeInTheDocument();
});
