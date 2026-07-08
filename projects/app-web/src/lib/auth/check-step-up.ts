import { createId } from '@paralleldrive/cuid2';
import { getRequestIP } from '@tanstack/react-start/server';
import type { SecureAction } from '@vers/contract-session';
import { sessionClient } from '../rpc/clients/session-client';
import { verificationClient } from '../rpc/clients/verification-client';
import { getAuthSession } from './get-auth-session';
import { verifyStepUpTransactionToken } from './step-up-transaction-token';

export type CheckStepUpResult =
  | { readonly status: 'not-needed' }
  | { readonly status: 'required'; readonly transactionID: string }
  | { readonly status: 'verified' };

export interface CheckStepUpOptions {
  readonly action: SecureAction;
  readonly target: string;
  readonly token: string | undefined;
}

/**
 * Gates a mutation behind step-up: callers with no live 2FA never gate at all. A 2FA-enabled
 * caller needs a transaction token minted from a completed step-up code check — an absent, forged,
 * expired, or mismatched-claim token starts a fresh pending transaction instead of trusting it.
 */
export async function checkStepUp(opts: Readonly<CheckStepUpOptions>): Promise<CheckStepUpResult> {
  const twoFactorVerification = await verificationClient.getVerification({
    target: opts.target,
    type: '2fa',
  });

  if (twoFactorVerification === null) {
    return { status: 'not-needed' };
  }

  if (
    opts.token !== undefined &&
    (await tryConsumeStepUpToken(opts.action, opts.target, opts.token))
  ) {
    return { status: 'verified' };
  }

  return { status: 'required', transactionID: await createPendingStepUpTransaction(opts) };
}

/** Redeems a step-up transaction token exactly once, folding every failure mode into `false`. */
async function tryConsumeStepUpToken(
  action: SecureAction,
  target: string,
  token: string,
): Promise<boolean> {
  const claims = await verifyStepUpTransactionToken(token).catch(() => null);

  if (claims === null || claims.action !== action || claims.target !== target) {
    return false;
  }

  const result = await sessionClient.stepUp.consumeTransactionToken({
    expiresAt: claims.expiresAt,
    jti: claims.jti,
  });

  return result.consumed;
}

async function createPendingStepUpTransaction(opts: Readonly<CheckStepUpOptions>): Promise<string> {
  const authSession = await getAuthSession();

  const transactionID = createId();

  await sessionClient.stepUp.createPendingTransaction({
    action: opts.action,
    id: transactionID,
    ipAddress: getRequestIP() ?? '0.0.0.0',
    sessionID: authSession.sessionID ?? null,
    target: opts.target,
  });

  return transactionID;
}
