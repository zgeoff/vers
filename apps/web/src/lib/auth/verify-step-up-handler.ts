import { isDefinedError, safe } from '@orpc/client';
import { getRequestIP } from '@tanstack/react-start/server';
import { SecureActionSchema } from '@vers/contract-session';
import * as z from 'zod';
import { logger } from '../../server/logger';
import { sessionClient } from '../rpc/clients/session-client';
import { verificationClient } from '../rpc/clients/verification-client';
import { createStepUpTransactionToken } from './create-step-up-transaction-token';
import { getAuthSession } from './get-auth-session';

export const VerifyStepUpInputSchema = z.object({
  action: SecureActionSchema,
  code: z.string().length(6, 'Invalid code'),
  target: z.string().min(1),
  transactionID: z.string().min(1),
});

type VerifyStepUpInput = z.infer<typeof VerifyStepUpInputSchema>;

type VerifyStepUpResult =
  | { readonly attemptsRemaining: number; readonly status: 'invalid-code' }
  | { readonly status: 'verified'; readonly token: string };

/**
 * Runs the shared step-up code check every gated mutation's inline challenge submits to: an
 * invalid code counts a failed attempt against the pending transaction, a valid one consumes it
 * and mints the transaction token the originating mutation redeems.
 */
export async function verifyStepUpHandler(input: VerifyStepUpInput): Promise<VerifyStepUpResult> {
  const [codeError] = await safe(
    verificationClient.verifyCode({ code: input.code, target: input.target, type: '2fa' }),
  );

  if (codeError) {
    if (!isDefinedError(codeError)) {
      logger.error({ err: codeError }, 'step-up code check failed');
    }

    const failedAttempt = await sessionClient.stepUp.recordFailedAttempt({
      id: input.transactionID,
    });

    return { attemptsRemaining: failedAttempt.attemptsRemaining, status: 'invalid-code' };
  }

  const authSession = await getAuthSession();

  const sessionID = authSession.sessionID ?? null;

  await sessionClient.stepUp.consumePendingTransaction({
    action: input.action,
    id: input.transactionID,
    ipAddress: getRequestIP() ?? '0.0.0.0',
    sessionID,
    target: input.target,
  });

  const minted = await createStepUpTransactionToken({
    action: input.action,
    sessionID,
    target: input.target,
  });

  return { status: 'verified', token: minted.token };
}
