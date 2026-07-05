import { generateExistingAccountEmail, generateWelcomeEmail } from '@vers/email-templates';
import { env } from '../../env';
import { logger } from '../../logger';
import type { Context } from '../../types';
import { SecureAction } from '../../types';
import { createPendingTransaction } from '../../utils/create-pending-transaction';
import { builder } from '../builder';
import { UNKNOWN_ERROR } from '../errors';
import { MutationErrorPayload } from '../types/mutation-error-payload';
import { VerificationRequiredPayload } from '../types/verification-required-payload';
import { VerificationType } from '../types/verification-type';
import { createPayloadResolver } from '../utils/create-payload-resolver';

interface Args {
  input: typeof StartEmailSignupInput.$inferInput;
}

export async function startEmailSignup(
  _: object,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  args: Args,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: Context,
): Promise<typeof StartEmailSignupPayload.$inferType> {
  try {
    const transactionID = createPendingTransaction(
      {
        action: SecureAction.Onboarding,
        sessionID: null,
        target: args.input.email,
      },
      ctx,
    );

    const existingUser = await ctx.services.user.getUser.query({
      email: args.input.email,
    });

    // as our user exists, let's email them to notify them that they've tried
    // to sign up on an email that already exists then return a success response
    // as to avoid user enumeration
    if (existingUser) {
      const email = await generateExistingAccountEmail({
        email: args.input.email,
      });

      await ctx.services.email.sendEmail.mutate({
        subject: 'You already have an account!',
        to: args.input.email,
        ...email,
      });

      return { transactionID };
    }

    const verification = await ctx.services.verification.createVerification.mutate({
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      period: 10 * 60, // 10 minutes
      target: args.input.email,
      type: 'onboarding',
    });

    const verificationURL = new URL(`${env.APP_WEB_URL}/verify-otp`);

    verificationURL.searchParams.set('type', VerificationType.ONBOARDING);
    verificationURL.searchParams.set('target', args.input.email);
    verificationURL.searchParams.set('code', verification.otp);

    const email = await generateWelcomeEmail({
      verificationCode: verification.otp,
      verificationURL: verificationURL.toString(),
    });

    await ctx.services.email.sendEmail.mutate({
      subject: 'Welcome to vers!',
      to: args.input.email,
      ...email,
    });

    return { transactionID };
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(error);
    }

    return { error: UNKNOWN_ERROR };
  }
}

const StartEmailSignupInput = builder.inputType('StartEmailSignupInput', {
  fields: (t) => ({
    email: t.string({ required: true }),
  }),
});

const StartEmailSignupPayload = builder.unionType('StartEmailSignupPayload', {
  resolveType: createPayloadResolver(VerificationRequiredPayload),
  types: [VerificationRequiredPayload, MutationErrorPayload],
});

export const resolve = startEmailSignup;

builder.mutationField('startEmailSignup', (t) =>
  t.field({
    args: {
      input: t.arg({ required: true, type: StartEmailSignupInput }),
    },
    directives: {
      rateLimit: {
        duration: 60,
        limit: 10,
      },
    },
    resolve,
    type: StartEmailSignupPayload,
  }),
);
