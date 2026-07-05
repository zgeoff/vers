import { redirect } from 'react-router';
import { Client, fetchExchange } from '@urql/core';
import { authExchange as createAuthExchange } from '@urql/exchange-auth';
import { UnreachableCodeError } from '@vers/utils';
import { authSessionStorage } from '~/session/auth-session-storage.server';
import { verifySessionStorage } from '~/session/verify-session-storage.server';
import { Routes } from '~/types';
import { isURQLFetchError } from './is-urql-fetch-error.server';
import { logout } from './logout.server';
import { refreshAccessToken } from './refresh-access-token.server';

/**
 * Creates an Apollo GraphQL client.
 *
 * `authorization` and `x-session-id` headers are added to each operation
 * if values are available in the session storage.
 *
 * @param request - The request object
 * @returns An Apollo Client instance
 */
export async function createGQLClient(request: Request): Promise<Client> {
  const authSession = await authSessionStorage.getSession(
    request.headers.get('cookie'),
  );

  const verifySession = await verifySessionStorage.getSession(
    request.headers.get('cookie'),
  );

  const authExchange = createAuthExchange(async (utils) => {
    return {
      addAuthToOperation: (operation) => {
        const accessToken = authSession.get('accessToken');
        const sessionID = authSession.get('sessionID');
        const unverifiedSessionID = verifySession.get('login2FA#sessionID');

        const headers: Record<string, string> = {};

        if (accessToken) {
          headers['authorization'] = `Bearer ${accessToken}`;
        }

        if (unverifiedSessionID) {
          headers['x-session-id'] = unverifiedSessionID;
        } else if (sessionID) {
          headers['x-session-id'] = sessionID;
        }

        return utils.appendHeaders(operation, headers);
      },
      didAuthError(error) {
        return isURQLFetchError(error) && error.response.status === 401;
      },
      refreshAuth: async () => {
        authSession.unset('accessToken');

        const refreshToken = authSession.get('refreshToken');

        if (!refreshToken) {
          await logout(request, { redirectTo: Routes.Login });

          throw new UnreachableCodeError('logout throws a redirect');
        }

        const tokenPayload = await refreshAccessToken(request, {
          refreshToken,
          utils,
        });

        authSession.set('accessToken', tokenPayload.accessToken);
        authSession.set('refreshToken', tokenPayload.refreshToken);

        const setCookieHeader =
          await authSessionStorage.commitSession(authSession);

        // because we're using the request from our app's entry point, it hasn't been
        // processed by react-router yet, so we need to manually remove .data from
        // the path
        const redirectPath = new URL(request.url).pathname.replace('.data', '');

        // redirect to where we are with the refreshed session
        throw redirect(redirectPath, {
          headers: {
            'set-cookie': setCookieHeader,
          },
        });
      },
    };
  });

  const client = new Client({
    exchanges: [authExchange, fetchExchange],
    url: import.meta.env.VITE_API_URL,
  });

  return client;
}
