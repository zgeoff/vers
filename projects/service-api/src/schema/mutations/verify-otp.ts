import { logger } from '../../logger';
import type { Context } from '../../types';
import { SecureAction } from '../../types';
import { createTransactionToken } from '../../utils/create-transaction-token';
import { trackTransactionAttempt } from '../../utils/track-transaction-attempt';
import { builder } from '../builder';
import { INVALID_OTP_ERROR, UNKNOWN_ERROR } from '../errors';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { TwoFactorSuccessPayload } from '../types/two-factor-success-payload';
import { VerificationType } from '../types/verification-type';
import { createPayloadResolver } from '../utils/create-payload-resolver';
import { resolveVerificationType } from '../utils/resolve-verification-type';

interface Args {
  input: typeof VerifyOTPInput.$inferInput;
}

export async function verifyOTP(
  _: object,
  args: Args,
  ctx: Context,
): Promise<typeof VerifyOTPPayload.$inferType> {
  try {
    trackTransactionAttempt(args.input.transactionID);

    const verification = await ctx.services.verification.verifyCode.mutate({
      code: args.input.code,
      target: args.input.target,
      type: resolveVerificationType(args.input.type),
    });

    if (!verification) {
      return {
        error: INVALID_OTP_ERROR,
      };
    }

    const transactionToken = await createTransactionToken(
      {
        action: VERIFICATION_TYPE_TO_SECURE_ACTION[args.input.type],
        ipAddress: ctx.ipAddress,
        sessionID: args.input.sessionID ?? null,
        target: verification.target,
        transactionID: args.input.transactionID,
      },
      ctx,
    );

    return { transactionToken };
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(error);
    }

    return { error: UNKNOWN_ERROR };
  }
}

const VERIFICATION_TYPE_TO_SECURE_ACTION: Record<VerificationType, SecureAction> = {
  [VerificationType.CHANGE_EMAIL]: SecureAction.ChangeEmail,
  [VerificationType.CHANGE_EMAIL_CONFIRMATION]: SecureAction.ChangeEmailConfirmation,
  [VerificationType.CHANGE_PASSWORD]: SecureAction.ChangePassword,
  [VerificationType.ONBOARDING]: SecureAction.Onboarding,
  [VerificationType.RESET_PASSWORD]: SecureAction.ResetPassword,
  [VerificationType.TWO_FACTOR_AUTH]: SecureAction.TwoFactorAuth,
  [VerificationType.TWO_FACTOR_AUTH_DISABLE]: SecureAction.TwoFactorAuthDisable,
  [VerificationType.TWO_FACTOR_AUTH_SETUP]: SecureAction.TwoFactorAuthSetup,
};

const VerifyOTPInput = builder.inputType('VerifyOTPInput', {
  fields: (t) => ({
    code: t.string({ required: true }),
    sessionID: t.string({ required: false }),
    target: t.string({ required: true }),
    transactionID: t.string({ required: true }),
    type: t.field({ required: true, type: VerificationType }),
  }),
});

const VerifyOTPPayload = builder.unionType('VerifyOTPPayload', {
  resolveType: createPayloadResolver(TwoFactorSuccessPayload),
  types: [TwoFactorSuccessPayload, MutationErrorPayload],
});

export const resolve = verifyOTP;

builder.mutationField('verifyOTP', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: VerifyOTPInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve: verifyOTP,
    type: VerifyOTPPayload,
  }),
);
