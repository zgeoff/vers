import { generateChangeEmailVerificationEmail } from '@vers/email-templates';
import { env } from '~/env';
import { logger } from '~/logger';
import type { AuthedContext } from '~/types';
import { SecureAction } from '~/types';
import { createPendingTransaction } from '~/utils/create-pending-transaction';
import { verifyTransactionToken } from '~/utils/verify-transaction-token';
import { builder } from '../builder';
import { UNKNOWN_ERROR } from '../errors';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { VerificationRequiredPayload } from '../types/verification-required-payload';
import { VerificationType } from '../types/verification-type';
import { createPayloadResolver } from '../utils/create-payload-resolver';
import { requireAuth } from '../utils/require-auth';

interface Args {
  input: typeof StartChangeUserEmailInput.$inferInput;
}

/**
 * @description Initiates the email change process after 2FA verification.
 * Creates a verification record for the new email address and sends a verification email.
 * Returns a transaction ID for the email verification process.
 *
 * @example
 * ```gql
 * mutation StartChangeUserEmail($input: StartChangeUserEmailInput!) {
 *   startChangeUserEmail(input: $input) {
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
export async function startChangeUserEmail(
  _: object,
  args: Args,
  ctx: AuthedContext,
): Promise<typeof StartChangeUserEmailPayload.$inferType> {
  try {
    const isTwoFactorEnabled = await ctx.services.verification.getVerification.query({
      target: ctx.user.email,
      type: '2fa',
    });

    if (isTwoFactorEnabled) {
      const isValidTransaction = await verifyTransactionToken(
        {
          action: SecureAction.ChangeEmail,
          target: ctx.user.email,
          token: args.input.transactionToken,
        },
        ctx,
      );

      if (!isValidTransaction) {
        return { error: UNKNOWN_ERROR };
      }
    }

    // check if the new email is already in use
    const existingUser = await ctx.services.user.getUser.query({
      email: args.input.email,
    });

    if (existingUser) {
      return { error: UNKNOWN_ERROR };
    }

    const verification = await ctx.services.verification.createVerification.mutate({
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
      period: 15 * 60, // 15 minutes
      target: args.input.email,
      type: 'change-email',
    });

    const verificationURL = new URL(`${env.APP_WEB_URL}/verify-otp`);

    verificationURL.searchParams.set('target', args.input.email);
    verificationURL.searchParams.set('code', verification.otp);
    verificationURL.searchParams.set('type', VerificationType.CHANGE_EMAIL_CONFIRMATION);

    const { html, plainText } = await generateChangeEmailVerificationEmail({
      newEmail: args.input.email,
      verificationCode: verification.otp,
      verificationURL: verificationURL.toString(),
    });

    await ctx.services.email.sendEmail.mutate({
      html,
      plainText,
      subject: 'Verify Your New Email Address',
      to: args.input.email,
    });

    const transactionID = createPendingTransaction(
      {
        action: SecureAction.ChangeEmailConfirmation,
        sessionID: ctx.session.id,
        target: args.input.email,
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

const StartChangeUserEmailInput = builder.inputType('StartChangeUserEmailInput', {
  fields: (t) => ({
    email: t.string({ required: true }),
    transactionToken: t.string({ required: false }),
  }),
});

const StartChangeUserEmailPayload = builder.unionType('StartChangeUserEmailPayload', {
  resolveType: createPayloadResolver(VerificationRequiredPayload),
  types: [VerificationRequiredPayload, MutationErrorPayload],
});

export const resolve = requireAuth(startChangeUserEmail);

builder.mutationField('startChangeUserEmail', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: StartChangeUserEmailInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve,
    type: StartChangeUserEmailPayload,
  }),
);
