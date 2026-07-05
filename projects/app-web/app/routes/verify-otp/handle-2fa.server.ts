import { redirect } from 'react-router';
import { safeRedirect } from 'remix-utils/safe-redirect';
import invariant from 'tiny-invariant';
import { FinishLoginWith2FAMutation } from '~/data/mutations/finish-login-with-2fa';
import type { ForceLogoutPayload } from '~/gql/graphql';
import { authSessionStorage } from '~/session/auth-session-storage.server';
import { verifySessionStorage } from '~/session/verify-session-storage.server';
import { Routes } from '~/types';
import { handleGQLError } from '~/utils/handle-gql-error';
import { isMutationError } from '~/utils/is-mutation-error';
import type { HandleVerificationContext } from './types';

export async function handle2FA(ctx: HandleVerificationContext) {
  invariant(ctx.submission.status === 'success', 'submission should be successful by now');

  const result = await ctx.client.mutation(FinishLoginWith2FAMutation, {
    input: {
      target: ctx.submission.value.target,
      transactionToken: ctx.transactionToken,
    },
  });

  if (result.error) {
    handleGQLError(result.error);

    throw result.error;
  }

  invariant(result.data, 'if no error, there must be data');

  if (isMutationError(result.data.finishLoginWith2FA)) {
    throw new Error(result.data.finishLoginWith2FA.error.message);
  }

  const verifySession = await verifySessionStorage.getSession(ctx.request.headers.get('cookie'));

  // yeet the transaction ID as we don't need it anymore
  verifySession.unset('login2FA#transactionID');

  // if we need to force logout, set our session as needed then redirect
  if (isForceLogoutPayload(result.data.finishLoginWith2FA)) {
    verifySession.set('loginLogout#email', ctx.submission.value.target);
    verifySession.set(
      'loginLogout#transactionToken',
      result.data.finishLoginWith2FA.transactionToken,
    );

    return redirect(Routes.LoginForceLogout, {
      headers: {
        'set-cookie': await verifySessionStorage.commitSession(verifySession),
      },
    });
  }

  // if we're here, we've received our tokens and we can set the auth session
  const authSession = await authSessionStorage.getSession(ctx.request.headers.get('cookie'));

  authSession.set('sessionID', result.data.finishLoginWith2FA.session.id);
  authSession.set('accessToken', result.data.finishLoginWith2FA.accessToken);
  authSession.set('refreshToken', result.data.finishLoginWith2FA.refreshToken);

  // now that we've put our verified our session into our auth session, we can unset it from
  // our 2FA session data
  verifySession.unset('login2FA#sessionID');

  const redirectTo = ctx.submission.value.redirect ?? Routes.Nexus;

  const headers = new Headers();

  const verifySetCookieHeader = await verifySessionStorage.commitSession(verifySession);

  headers.append('set-cookie', verifySetCookieHeader);

  const authSetCookieHeader = await authSessionStorage.commitSession(authSession, {
    expires: new Date(result.data.finishLoginWith2FA.session.expiresAt),
  });

  headers.append('set-cookie', authSetCookieHeader);

  return redirect(safeRedirect(redirectTo), { headers });
}

function isForceLogoutPayload(payload: ForceLogoutPayload | object): payload is ForceLogoutPayload {
  return 'transactionToken' in payload;
}
