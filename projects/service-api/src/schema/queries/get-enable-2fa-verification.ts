import { GraphQLError } from 'graphql';
import invariant from 'tiny-invariant';
import { logger } from '../../logger';
import type { Context } from '../../types';
import { builder } from '../builder';
import { requireAuth } from '../utils/require-auth';

interface TwoFactorVerificationData {
  otpURI: string;
}

/**
 * @description Retrieves the verification URI for 2FA setup
 *
 * @example
 * ```gql
 * query GetEnable2FAVerification {
 *   getEnable2FAVerification {
 *     otpURI
 *   }
 * }
 * ```
 */
export async function getEnable2FAVerification(
  _: object,
  __: object,
  ctx: Context,
): Promise<TwoFactorVerificationData> {
  invariant(ctx.user, 'user is required in an authed resolver');

  try {
    const { otpURI } = await ctx.services.verification.get2FAVerificationURI.query({
      target: ctx.user.email,
    });

    return { otpURI };
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error);
    }

    throw new GraphQLError('An unknown error occurred', {
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
      },
    });
  }
}

const TwoFactorVerification = builder.objectRef<TwoFactorVerificationData>('TwoFactorVerification');

TwoFactorVerification.implement({
  fields: (t) => ({
    otpURI: t.exposeString('otpURI'),
  }),
});

export const resolve = requireAuth(getEnable2FAVerification);

builder.queryField('getEnable2FAVerification', (t) =>
  t.field({
    directives: {
      rateLimit: {
        duration: 60,
        limit: 20,
      },
    },
    resolve,
    type: TwoFactorVerification,
  }),
);
