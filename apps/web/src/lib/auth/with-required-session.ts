import { ORPCError } from '@orpc/client';
import { getRequestHeader, getRequestUrl } from '@tanstack/react-start/server';
import { getLoginPathForRequest } from './get-login-path-for-request';
import { runLogout } from './run-logout';

export async function withRequiredSession<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    // a service refuses the call of a session whose row another device's sign-in deleted; that
    // refusal is access control, so it ends in the login redirect rather than on an error boundary
    if (error instanceof ORPCError && error.defined && error.code === 'UNAUTHORIZED') {
      await runLogout({
        redirectTo: getLoginPathForRequest(getRequestUrl(), getRequestHeader('referer')),
      });
    }

    throw error;
  }
}
