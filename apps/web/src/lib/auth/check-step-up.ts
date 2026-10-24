import { createId } from '@paralleldrive/cuid2';
import { getRequestIP } from '@tanstack/react-start/server';
import type { SecureAction } from '@vers/contract-session';
import { sessionClient } from '../rpc/clients/session-client';
import { verificationClient } from '../rpc/clients/verification-client';
import { readAuthSession } from './read-auth-session';

type CheckStepUpResult =
  | { readonly status: 'not-needed' }
  | { readonly status: 'required'; readonly transactionID: string }
  | { readonly status: 'verified' };

interface CheckStepUpOptions {
  readonly action: SecureAction;
  readonly target: string;
  readonly token: string | undefined;
}

export async function checkStepUp(opts: Readonly<CheckStepUpOptions>): Promise<CheckStepUpResult> {
  const twoFactorVerification = await verificationClient.getVerification({
    target: opts.target,
    type: '2fa',
  });

  if (twoFactorVerification === null) {
    return { status: 'not-needed' };
  }

  const authSession = await readAuthSession();

  const sessionID = authSession.sessionID ?? null;

  if (opts.token !== undefined) {
    const grant = await sessionClient.stepUp.consumeGrant({
      action: opts.action,
      sessionID,
      target: opts.target,
      token: opts.token,
    });

    if (grant.consumed) {
      return { status: 'verified' };
    }
  }

  return {
    status: 'required',
    transactionID: await createPendingStepUpTransaction(opts, sessionID),
  };
}

async function createPendingStepUpTransaction(
  opts: Readonly<CheckStepUpOptions>,
  sessionID: string | null,
): Promise<string> {
  const transactionID = createId();

  await sessionClient.stepUp.createPendingTransaction({
    action: opts.action,
    id: transactionID,
    ipAddress: getRequestIP() ?? '0.0.0.0',
    sessionID,
    target: opts.target,
  });

  return transactionID;
}
