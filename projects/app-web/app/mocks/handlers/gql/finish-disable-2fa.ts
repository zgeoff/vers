import { HttpResponse, graphql } from 'msw';
import type { FinishDisable2FaInput, FinishDisable2FaPayload } from '~/gql/graphql';
import { db } from '../../db';
import { TWO_FACTOR_NOT_ENABLED_ERROR, UNKNOWN_ERROR } from '../../errors';
import { decodeMockJWT } from '../../utils/decode-mock-jwt';
import { isValidTransactionToken } from './utils/is-valid-transaction-token';

interface FinishDisable2FAVariables {
  input: FinishDisable2FaInput;
}

interface FinishDisable2FAResponse {
  finishDisable2FA: FinishDisable2FaPayload;
}

export const FinishDisable2FA = graphql.mutation<
  FinishDisable2FAResponse,
  FinishDisable2FAVariables
>('FinishDisable2FA', (opts) => {
  const authHeader = opts.request.headers.get('authorization');

  if (!authHeader) {
    return HttpResponse.json({
      errors: [{ message: 'Unauthorized' }],
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const payload = decodeMockJWT(token);

  const user = db.user.findFirst({
    where: { id: { equals: payload.sub } },
  });

  if (!user) {
    return HttpResponse.json({
      data: {
        finishDisable2FA: {
          error: UNKNOWN_ERROR,
        },
      },
    });
  }

  if (!isValidTransactionToken(opts.variables.input.transactionToken)) {
    return HttpResponse.json({
      data: {
        finishDisable2FA: {
          error: UNKNOWN_ERROR,
        },
      },
    });
  }

  const twoFactorVerification = db.verification.findFirst({
    where: {
      target: { equals: user.email },
      type: { equals: '2fa' },
    },
  });

  if (!twoFactorVerification) {
    return HttpResponse.json({
      data: {
        finishDisable2FA: {
          error: TWO_FACTOR_NOT_ENABLED_ERROR,
        },
      },
    });
  }

  db.verification.delete({
    where: {
      id: { equals: twoFactorVerification.id },
    },
  });

  return HttpResponse.json({
    data: {
      finishDisable2FA: {
        success: true,
      },
    },
  });
});
