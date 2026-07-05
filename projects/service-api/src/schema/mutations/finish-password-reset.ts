import { generatePasswordChangedEmail } from '@vers/email-templates';
import { logger } from '../../logger';
import type { Context } from '../../types';
import { SecureAction } from '../../types';
import { verifyTransactionToken } from '../../utils/verify-transaction-token';
import { builder } from '../builder';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { MutationSuccess } from '../types/mutation-success';
import { createPayloadResolver } from '../utils/create-payload-resolver';

interface Args {
  input: typeof FinishPasswordResetInput.$inferInput;
}

/**
 * @description Completes a password reset by updating the user's password and sending a confirmation email.
 *
 * Always returns a successful response to prevent enumeration attacks.
 *
 * @example
 * ```gql
 * mutation FinishPasswordReset {
 *   finishPasswordReset(input: {
 *     email: "test@example.com",
 *     password: "newPassword123"
 *   }) {
 *     ... on FinishPasswordResetPayload {
 *       success
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
export async function finishPasswordReset(
  _: object,
  args: Args,
  ctx: Context,
): Promise<typeof FinishPasswordResetPayload.$inferType> {
  try {
    const user = await ctx.services.user.getUser.query({
      email: args.input.email,
    });

    if (!user) {
      return { success: true };
    }

    const twoFactorVerification = await ctx.services.verification.getVerification.query({
      target: args.input.email,
      type: '2fa',
    });

    const isValidTransaction = await verifyTransactionToken(
      {
        action: SecureAction.ResetPassword,
        target: args.input.email,
        token: args.input.transactionToken,
      },
      ctx,
    );

    if (twoFactorVerification && !isValidTransaction) {
      return { success: true };
    }

    await ctx.services.user.resetPassword.mutate({
      id: user.id,
      password: args.input.password,
      resetToken: args.input.resetToken,
    });

    const email = await generatePasswordChangedEmail({
      email: user.email,
    });

    await ctx.services.email.sendEmail.mutate({
      html: email.html,
      plainText: email.plainText,
      subject: 'Password Changed',
      to: user.email,
    });

    return { success: true };
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(error);
    }

    return { success: true };
  }
}

const FinishPasswordResetInput = builder.inputType('FinishPasswordResetInput', {
  fields: (t) => ({
    email: t.string({ required: true }),
    password: t.string({ required: true }),
    resetToken: t.string({ required: true }),
    transactionToken: t.string({ required: false }),
  }),
});

const FinishPasswordResetPayload = builder.unionType('FinishPasswordResetPayload', {
  resolveType: createPayloadResolver(MutationSuccess),
  types: [MutationSuccess, MutationErrorPayload],
});

export const resolve = finishPasswordReset;

builder.mutationField('finishPasswordReset', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: FinishPasswordResetInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve: finishPasswordReset,
    type: FinishPasswordResetPayload,
  }),
);
