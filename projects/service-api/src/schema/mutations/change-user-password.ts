import { generatePasswordChangedEmail } from '@vers/email-templates';
import { logger } from '~/logger';
import type { AuthedContext } from '~/types';
import { SecureAction } from '~/types';
import { verifyTransactionToken } from '~/utils/verify-transaction-token';
import { builder } from '../builder';
import { INVALID_PASSWORD_ERROR, UNKNOWN_ERROR } from '../errors';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { MutationSuccess } from '../types/mutation-success';
import { createPayloadResolver } from '../utils/create-payload-resolver';
import { requireAuth } from '../utils/require-auth';

interface Args {
  input: typeof ChangeUserPasswordInput.$inferInput;
}

/**
 * @description Changes a user's password after verifying their current password.
 * If 2FA is enabled, requires a valid transaction token from 2FA verification.
 * Sends a confirmation email after successful password change.
 *
 * @example
 * ```gql
 * mutation ChangeUserPassword($input: ChangeUserPasswordInput!) {
 *   changeUserPassword(input: $input) {
 *     ... on MutationSuccess {
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
export async function changeUserPassword(
  _: object,
  args: Args,
  ctx: AuthedContext,
): Promise<typeof ChangeUserPasswordPayload.$inferType> {
  try {
    // verify our existing password immediately as verifying our transaction token
    // burns it, so we need to do this first to avoid a horrible UX for a simple mistake.
    const isPasswordValid = await ctx.services.user.verifyPassword.mutate({
      email: ctx.user.email,
      password: args.input.currentPassword,
    });

    // we return a password-specific error here but as we're identifying our user from authed
    // context we're not at risk of enumeration attacks.
    if (!isPasswordValid.success) {
      return {
        error: INVALID_PASSWORD_ERROR,
      };
    }

    const is2FAEnabled = await ctx.services.verification.getVerification.query({
      target: ctx.user.email,
      type: '2fa',
    });

    if (is2FAEnabled) {
      const isValidTransaction = await verifyTransactionToken(
        {
          action: SecureAction.ChangePassword,
          target: ctx.user.email,
          token: args.input.transactionToken,
        },
        ctx,
      );

      if (!isValidTransaction) {
        return {
          error: UNKNOWN_ERROR,
        };
      }
    }

    await ctx.services.user.changePassword.mutate({
      id: ctx.user.id,
      password: args.input.newPassword,
    });

    const email = await generatePasswordChangedEmail({
      email: ctx.user.email,
    });

    await ctx.services.email.sendEmail.mutate({
      html: email.html,
      plainText: email.plainText,
      subject: 'Your password has been changed',
      to: ctx.user.email,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error);
    }

    return { error: UNKNOWN_ERROR };
  }
}

const ChangeUserPasswordInput = builder.inputType('ChangeUserPasswordInput', {
  fields: (t) => ({
    currentPassword: t.string({ required: true }),
    newPassword: t.string({ required: true }),
    transactionToken: t.string({ required: false }),
  }),
});

const ChangeUserPasswordPayload = builder.unionType('ChangeUserPasswordPayload', {
  resolveType: createPayloadResolver(MutationSuccess),
  types: [MutationSuccess, MutationErrorPayload],
});

export const resolve = requireAuth(changeUserPassword);

builder.mutationField('changeUserPassword', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: ChangeUserPasswordInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve,
    type: ChangeUserPasswordPayload,
  }),
);
