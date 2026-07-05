import { HttpResponse, graphql } from 'msw';
import type { FinishPasswordResetInput, FinishPasswordResetPayload } from '~/gql/graphql';
import { db } from '../../db';
import { isValidTransactionToken } from './utils/is-valid-transaction-token';

interface FinishPasswordResetVariables {
  input: FinishPasswordResetInput;
}

interface FinishPasswordResetResponse {
  finishPasswordReset: FinishPasswordResetPayload;
}

export const FinishPasswordReset = graphql.mutation<
  FinishPasswordResetResponse,
  FinishPasswordResetVariables
>('FinishPasswordReset', (opts) => {
  const user = db.user.findFirst({
    where: {
      email: { equals: opts.variables.input.email },
    },
  });

  // return a success response as to avoid user enumeration if the user doesn't exist
  if (!user) {
    return HttpResponse.json({
      data: {
        finishPasswordReset: {
          success: true,
        },
      },
    });
  }

  const twoFactorVerification = db.verification.findFirst({
    where: {
      target: { equals: opts.variables.input.email },
      type: { equals: '2fa' },
    },
  });

  const isTransactionTokenValid = isValidTransactionToken(opts.variables.input.transactionToken);

  // return a success response if we have 2FA but our transaction token isn't valid
  if (twoFactorVerification && !isTransactionTokenValid) {
    return HttpResponse.json({
      data: {
        finishPasswordReset: {
          success: true,
        },
      },
    });
  }

  db.user.update({
    data: {
      password: opts.variables.input.password,
      updatedAt: new Date().toISOString(),
    },
    where: {
      id: { equals: user.id },
    },
  });

  db.session.deleteMany({
    where: {
      userID: { equals: user.id },
    },
  });

  return HttpResponse.json({
    data: {
      finishPasswordReset: {
        success: true,
      },
    },
  });
});
