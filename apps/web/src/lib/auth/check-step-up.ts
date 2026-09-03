import { createId } from '@paralleldrive/cuid2';
import { getRequestIP } from '@tanstack/react-start/server';
import type { SecureAction } from '@vers/contract-session';
import { logger } from '../../server/logger';
import { sessionClient } from '../rpc/clients/session-client';
import { verificationClient } from '../rpc/clients/verification-client';
import { verifyStepUpTransactionToken } from './create-step-up-transaction-token';
import { getAuthSession } from './get-auth-session';

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

  const authSession = await getAuthSession();

  const sessionID = authSession.sessionID ?? null;

  if (opts.token !== undefined) {
    const consumed = await tryConsumeStepUpToken(opts.action, opts.target, opts.token, sessionID);

    if (consumed) {
      return { status: 'verified' };
    }
  }

  return {
    status: 'required',
    transactionID: await createPendingStepUpTransaction(opts, sessionID),
  };
}

async function tryConsumeStepUpToken(
  action: SecureAction,
  target: string,
  token: string,
  sessionID: string | null,
): Promise<boolean> {
  const claims = await verifyStepUpTransactionToken(token).catch((error: unknown) => {
    logger.warn({ err: error }, 'step-up token verification failed');

    return null;
  });

  if (
    claims === null ||
    claims.action !== action ||
    claims.target !== target ||
    claims.sessionID !== sessionID
  ) {
    return false;
  }

  const result = await sessionClient.stepUp.consumeTransactionToken({
    expiresAt: claims.expiresAt,
    jti: claims.jti,
  });

  return result.consumed;
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
