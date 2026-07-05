import { generateResetPasswordEmail } from '@vers/email-templates';
import { env } from '../../env';
import { logger } from '../../logger';
import type { Context } from '../../types';
import { SecureAction } from '../../types';
import { createPendingTransaction } from '../../utils/create-pending-transaction';
import { builder } from '../builder';
import { UNKNOWN_ERROR } from '../errors';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { MutationSuccess } from '../types/mutation-success';
import { VerificationRequiredPayload } from '../types/verification-required-payload';
import { VerificationType } from '../types/verification-type';
import { createPayloadResolver } from '../utils/create-payload-resolver';

interface Args {
  input: typeof StartPasswordResetInput.$inferInput;
}

/**
 * @description Initiates a password reset for a user by sending a verification email
 *
 * @example
 * ```gql
 * mutation StartPasswordReset {
 *   startPasswordReset(input: { email: "user@example.com" }) {
 *     ... on MutationSuccess {
 *       success
 *     }
 *
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
export async function startPasswordReset(
  _: object,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  args: Args,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: Context,
): Promise<typeof StartPasswordResetPayload.$inferType> {
  try {
    const user = await ctx.services.user.getUser.query({
      email: args.input.email,
    });

    // return a success response as to avoid user enumeration if the user doesn't exist
    if (!user) {
      return { success: true };
    }

    const { resetToken } = await ctx.services.user.createPasswordResetToken.mutate({
      id: user.id,
    });

    const twoFactorVerification = await ctx.services.verification.getVerification.query({
      target: args.input.email,
      type: '2fa',
    });

    let resetURL: URL;

    // if we have 2FA enabled the user needs to verify a OTP prior to resetting their password
    if (twoFactorVerification) {
      const resetURLSearchParams = new URLSearchParams({
        email: args.input.email,
        token: resetToken,
      });

      const redirectPath = `/reset-password?${resetURLSearchParams.toString()}`;

      resetURL = new URL(`${env.APP_WEB_URL}/verify-otp`);

      resetURL.searchParams.set('type', VerificationType.RESET_PASSWORD);
      resetURL.searchParams.set('target', args.input.email);
      resetURL.searchParams.set('redirect', redirectPath);
    } else {
      // if we don't have 2FA enabled the user can reset their password directly
      resetURL = new URL(`${env.APP_WEB_URL}/reset-password`);

      resetURL.searchParams.set('token', resetToken);
      resetURL.searchParams.set('email', args.input.email);
    }

    const { html, plainText } = await generateResetPasswordEmail({
      resetURL: resetURL.toString(),
    });

    await ctx.services.email.sendEmail.mutate({
      html,
      plainText,
      subject: 'Reset Your Password',
      to: args.input.email,
    });

    const transactionID = createPendingTransaction(
      {
        action: SecureAction.ResetPassword,
        sessionID: null,
        target: args.input.email,
      },
      ctx,
    );

    if (twoFactorVerification) {
      return { transactionID };
    }

    return { success: true };
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(error);
    }

    return { error: UNKNOWN_ERROR };
  }
}

const StartPasswordResetInput = builder.inputType('StartPasswordResetInput', {
  fields: (t) => ({
    email: t.string({ required: true }),
  }),
});

const StartPasswordResetPayload = builder.unionType('StartPasswordResetPayload', {
  resolveType: createPayloadResolver(MutationSuccess),
  types: [MutationSuccess, VerificationRequiredPayload, MutationErrorPayload],
});

export const resolve = startPasswordReset;

builder.mutationField('startPasswordReset', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: StartPasswordResetInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve: startPasswordReset,
    type: StartPasswordResetPayload,
  }),
);
