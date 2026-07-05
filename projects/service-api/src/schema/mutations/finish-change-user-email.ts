import { generateChangeEmailNotificationEmail } from '@vers/email-templates';
import { logger } from '../../logger';
import type { AuthedContext } from '../../types';
import { SecureAction } from '../../types';
import { verifyTransactionToken } from '../../utils/verify-transaction-token';
import { builder } from '../builder';
import { UNKNOWN_ERROR } from '../errors';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { MutationSuccess } from '../types/mutation-success';
import { createPayloadResolver } from '../utils/create-payload-resolver';
import { requireAuth } from '../utils/require-auth';

interface Args {
  input: typeof FinishChangeUserEmailInput.$inferInput;
}

/**
 * @description Completes the email change process after verification of the new email.
 * Updates the user's email address and sends a notification to the old email address.
 *
 * @example
 * ```gql
 * mutation FinishChangeUserEmail($input: FinishChangeUserEmailInput!) {
 *   finishChangeUserEmail(input: $input) {
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
export async function finishChangeUserEmail(
  _: object,
  args: Args,
  ctx: AuthedContext,
): Promise<typeof FinishChangeUserEmailPayload.$inferType> {
  try {
    const isValidTransaction = await verifyTransactionToken(
      {
        action: SecureAction.ChangeEmailConfirmation,
        target: args.input.email,
        token: args.input.transactionToken,
      },
      ctx,
    );

    if (!isValidTransaction) {
      return { error: UNKNOWN_ERROR };
    }

    const prevEmail = ctx.user.email;

    await ctx.services.user.updateEmail.mutate({
      email: args.input.email,
      id: ctx.user.id,
    });

    const { html, plainText } = await generateChangeEmailNotificationEmail();

    await ctx.services.email.sendEmail.mutate({
      html,
      plainText,
      subject: 'Your Email Address Has Been Changed',
      to: prevEmail,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error);
    }

    return { error: UNKNOWN_ERROR };
  }
}

const FinishChangeUserEmailInput = builder.inputType('FinishChangeUserEmailInput', {
  fields: (t) => ({
    email: t.string({ required: true }),
    transactionToken: t.string({ required: true }),
  }),
});

const FinishChangeUserEmailPayload = builder.unionType('FinishChangeUserEmailPayload', {
  resolveType: createPayloadResolver(MutationSuccess),
  types: [MutationSuccess, MutationErrorPayload],
});

export const resolve = requireAuth(finishChangeUserEmail);

builder.mutationField('finishChangeUserEmail', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: FinishChangeUserEmailInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve,
    type: FinishChangeUserEmailPayload,
  }),
);
