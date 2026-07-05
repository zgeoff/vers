import { logger } from '../../logger';
import type { AuthedContext } from '../../types';
import { SecureAction } from '../../types';
import { createPendingTransaction } from '../../utils/create-pending-transaction';
import { builder } from '../builder';
import { TWO_FACTOR_ALREADY_ENABLED_ERROR, UNKNOWN_ERROR } from '../errors';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { VerificationRequiredPayload } from '../types/verification-required-payload';
import { createPayloadResolver } from '../utils/create-payload-resolver';
import { requireAuth } from '../utils/require-auth';

/**
 * @description Initiates the 2FA setup process for a user by creating a verification record
 *
 * @example
 * ```gql
 * mutation StartEnable2FA($input: StartEnable2FAInput!) {
 *   startEnable2FA(input: $input) {
 *     ... on VerificationRequiredPayload {
 *       transactionID
 *     }
 *
 *     ... on MutationErrorPayload {
 *       error {
 *         title
 *         message
 *       }
 *     }
 *   }
 * }
 * ```
 */
export async function startEnable2FA(
  _: object,
  __: object,
  ctx: AuthedContext,
): Promise<typeof StartEnable2FAPayload.$inferType> {
  try {
    const is2FAEnabled = await ctx.services.verification.getVerification.query({
      target: ctx.user.email,
      type: '2fa',
    });

    if (is2FAEnabled) {
      return {
        error: TWO_FACTOR_ALREADY_ENABLED_ERROR,
      };
    }

    const existing2FASetupVerification = await ctx.services.verification.getVerification.query({
      target: ctx.user.email,
      type: '2fa-setup',
    });

    // If there's an existing 2FA setup verification, delete it
    if (existing2FASetupVerification) {
      await ctx.services.verification.deleteVerification.mutate({
        id: existing2FASetupVerification.id,
      });
    }

    await ctx.services.verification.createVerification.mutate({
      target: ctx.user.email,
      type: '2fa-setup',
    });

    const transactionID = createPendingTransaction(
      {
        action: SecureAction.TwoFactorAuthSetup,
        sessionID: ctx.session.id,
        target: ctx.user.email,
      },
      ctx,
    );

    return { transactionID };
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error);
    }

    return { error: UNKNOWN_ERROR };
  }
}

const StartEnable2FAInput = builder.inputType('StartEnable2FAInput', {
  fields: (t) => ({
    placeholder: t.string({ required: false }),
  }),
});

const StartEnable2FAPayload = builder.unionType('StartEnable2FAPayload', {
  resolveType: createPayloadResolver(VerificationRequiredPayload),
  types: [VerificationRequiredPayload, MutationErrorPayload],
});

export const resolve = requireAuth(startEnable2FA);

builder.mutationField('startEnable2FA', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: StartEnable2FAInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve,
    type: StartEnable2FAPayload,
  }),
);
