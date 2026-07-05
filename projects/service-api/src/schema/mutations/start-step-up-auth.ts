import { logger } from '../../logger';
import type { AuthedContext } from '../../types';
import { SecureAction } from '../../types';
import { createPendingTransaction } from '../../utils/create-pending-transaction';
import { builder } from '../builder';
import { TWO_FACTOR_NOT_ENABLED_ERROR, UNKNOWN_ERROR } from '../errors';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { StepUpAction } from '../types/step-up-action';
import { VerificationRequiredPayload } from '../types/verification-required-payload';
import { createPayloadResolver } from '../utils/create-payload-resolver';
import { requireAuth } from '../utils/require-auth';

interface Args {
  input: typeof StartStepUpAuthInput.$inferInput;
}

/**
 * @description Initiates step-up authentication for secure operations requiring 2FA.
 * Creates a pending transaction for 2FA verification and returns the transaction ID.
 *
 * This mutation is only used to initiate step up auth on a subset of secure actions;
 * actions requiring specific logic or create non-step-up  auth transactions are handled
 * in their respective mutations e.g. `startPasswordReset`
 *
 * @example
 * ```gql
 * mutation StartStepUpAuth($input: StartStepUpAuthInput!) {
 *   startStepUpAuth(input: $input) {
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
export async function startStepUpAuth(
  _: object,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  args: Args,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: AuthedContext,
): Promise<typeof StartStepUpAuthPayload.$inferType> {
  try {
    const is2FAEnabled = await ctx.services.verification.getVerification.query({
      target: ctx.user.email,
      type: '2fa',
    });

    if (!is2FAEnabled) {
      return {
        error: TWO_FACTOR_NOT_ENABLED_ERROR,
      };
    }

    const transactionID = createPendingTransaction(
      {
        action: STEP_UP_ACTION_TO_SECURE_ACTION[args.input.action],
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

const STEP_UP_ACTION_TO_SECURE_ACTION: Record<StepUpAction, SecureAction> = {
  [StepUpAction.CHANGE_EMAIL]: SecureAction.ChangeEmail,
  [StepUpAction.CHANGE_PASSWORD]: SecureAction.ChangePassword,
  [StepUpAction.DISABLE_2FA]: SecureAction.TwoFactorAuthDisable,
};

const StartStepUpAuthInput = builder.inputType('StartStepUpAuthInput', {
  fields: (t) => ({
    action: t.field({ required: true, type: StepUpAction }),
  }),
});

const StartStepUpAuthPayload = builder.unionType('StartStepUpAuthPayload', {
  resolveType: createPayloadResolver(VerificationRequiredPayload),
  types: [VerificationRequiredPayload, MutationErrorPayload],
});

export const resolve = requireAuth(startStepUpAuth);

builder.mutationField('startStepUpAuth', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: StartStepUpAuthInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve,
    type: StartStepUpAuthPayload,
  }),
);
