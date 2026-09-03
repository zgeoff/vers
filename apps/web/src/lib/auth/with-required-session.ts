import { ORPCError } from '@orpc/client';
import { getRequestUrl } from '@tanstack/react-start/server';
import { getLoginPathWithRedirect } from './get-login-path-with-redirect';
import { runLogout } from './run-logout';

export async function withRequiredSession<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    // a service refuses the call of a session whose row another device's sign-in deleted; that
    // refusal is access control, so it ends in the login redirect rather than on an error boundary
    if (error instanceof ORPCError && error.defined && error.code === 'UNAUTHORIZED') {
      await runLogout({ redirectTo: getLoginPathWithRedirect(getRequestUrl()) });
    }

    throw error;
  }
}
