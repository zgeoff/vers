import { redirect } from 'react-router';
import invariant from 'tiny-invariant';
import { FinishDisable2FAMutation } from '../../data/mutations/finish-disable-2fa';
import { verifySessionStorage } from '../../session/verify-session-storage.server';
import { Routes } from '../../types';
import { handleGQLError } from '../../utils/handle-gql-error';
import type { HandleVerificationContext } from './types';

export async function handle2FADisable(ctx: HandleVerificationContext) {
  invariant(ctx.submission.status === 'success', 'submission should be successful by now');

  const verifySession = await verifySessionStorage.getSession(ctx.request.headers.get('cookie'));

  // clean up the pending transaction ID
  verifySession.unset('disable2FA#transactionID');

  const result = await ctx.client.mutation(FinishDisable2FAMutation, {
    input: {
      transactionToken: ctx.transactionToken,
    },
  });

  if (result.error) {
    handleGQLError(result.error);

    throw result.error;
  }

  // regardless of the outcome, redirect to our account route to show the user the result.
  // if we failed, its low effort to have them try again.
  return redirect(Routes.Account, {
    headers: {
      'set-cookie': await verifySessionStorage.commitSession(verifySession),
    },
  });
}
