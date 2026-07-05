import { HttpResponse, graphql } from 'msw';
import type { FinishEnable2FaInput, FinishEnable2FaPayload } from '../../../gql/graphql';
import { db } from '../../db';
import { UNKNOWN_ERROR } from '../../errors';
import { decodeMockJWT } from '../../utils/decode-mock-jwt';
import { isValidTransactionToken } from './utils/is-valid-transaction-token';

interface FinishEnable2FAVariables {
  input: FinishEnable2FaInput;
}

interface FinishEnable2FAResponse {
  finishEnable2FA: FinishEnable2FaPayload;
}

export const FinishEnable2FA = graphql.mutation<FinishEnable2FAResponse, FinishEnable2FAVariables>(
  'FinishEnable2FA',
  (opts) => {
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
          finishEnable2FA: {
            error: UNKNOWN_ERROR,
          },
        },
      });
    }

    if (!isValidTransactionToken(opts.variables.input.transactionToken)) {
      return HttpResponse.json({
        data: {
          finishEnable2FA: {
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

    if (twoFactorVerification) {
      return HttpResponse.json({
        data: {
          finishEnable2FA: {
            error: UNKNOWN_ERROR,
          },
        },
      });
    }

    db.verification.update({
      data: {
        type: '2fa',
      },
      where: {
        target: { equals: user.email },
        type: { equals: '2fa-setup' },
      },
    });

    return HttpResponse.json({
      data: {
        finishEnable2FA: {
          success: true,
        },
      },
    });
  },
);
