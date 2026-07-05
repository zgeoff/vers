import { captureException } from '@sentry/react';
import { redirect } from 'react-router';
import { safeRedirect } from 'remix-utils/safe-redirect';
import { DeleteSessionMutation } from '~/data/mutations/delete-session';
import { authSessionStorage } from '~/session/auth-session-storage.server';
import { Routes } from '~/types';
import { combineHeaders } from './combine-headers.server';

interface LogoutOptions {
  deleteSession?: boolean | undefined;
  redirectTo?: string | undefined;
  responseInit?: ResponseInit;
}

/**
 * Logs out the user by deleting their session and clearing cookies.
 *
 * @param request - The request object
 * @param ctx - Context containing optional redirect path and response init
 * @throws Redirect to the specified path or home page
 */
export async function logout(request: Request, options: LogoutOptions = {}): Promise<never> {
  // the gql client module imports this one for its 401 handling, so a static
  // import here completes a cycle — deferring the import breaks it
  const { createGQLClient } = await import('./create-gql-client.server');

  const client = await createGQLClient(request);

  const authSession = await authSessionStorage.getSession(request.headers.get('cookie'));

  const sessionID = authSession.get('sessionID');

  if (sessionID && options.deleteSession) {
    // if we fail our server side session cleanup, ignore error's and continue.
    try {
      await client.mutation(DeleteSessionMutation, {
        input: {
          id: sessionID,
        },
      });
    } catch (error) {
      captureException(error);
    }
  }

  throw redirect(safeRedirect(options.redirectTo ?? Routes.Index), {
    ...options.responseInit,
    headers: combineHeaders(
      { 'set-cookie': await authSessionStorage.destroySession(authSession) },
      options.responseInit?.headers,
    ),
  });
}
