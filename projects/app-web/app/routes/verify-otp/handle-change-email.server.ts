import { redirect } from 'react-router';
import invariant from 'tiny-invariant';
import { verifySessionStorage } from '../../session/verify-session-storage.server';
import { Routes } from '../../types';
import type { HandleVerificationContext } from './types';

/**
 * Handles the verification of a step-up auth for email change.
 * This is the first step in the email change process, where we verify
 * the user's identity via 2FA before allowing them to change their email.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function handleChangeEmail(ctx: HandleVerificationContext): Promise<Response> {
  invariant(ctx.submission.status === 'success', 'submission should be successful by now');

  const verifySession = await verifySessionStorage.getSession();

  // clean up the pending transaction ID & capture our transaction token
  verifySession.unset('changeEmail#transactionID');
  verifySession.set('changeEmail#transactionToken', ctx.transactionToken);

  return redirect(Routes.AccountChangeEmail, {
    headers: {
      'set-cookie': await verifySessionStorage.commitSession(verifySession),
    },
  });
}
