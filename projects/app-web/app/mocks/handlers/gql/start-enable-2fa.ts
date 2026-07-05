import { HttpResponse, graphql } from 'msw';
import type { StartEnable2FaInput, StartEnable2FaPayload } from '../../../gql/graphql';
import { db } from '../../db';
import { TWO_FACTOR_ALREADY_ENABLED_ERROR, UNKNOWN_ERROR } from '../../errors';
import { decodeMockJWT } from '../../utils/decode-mock-jwt';

interface StartEnable2FAVariables {
  input: StartEnable2FaInput;
}

interface StartEnable2FAResponse {
  startEnable2FA: StartEnable2FaPayload;
}

export const StartEnable2FA = graphql.mutation<StartEnable2FAResponse, StartEnable2FAVariables>(
  'StartEnable2FA',
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
          startEnable2FA: {
            error: UNKNOWN_ERROR,
          },
        },
      });
    }

    const is2FAEnabled = db.verification.findFirst({
      where: {
        target: { equals: user.email },
        type: { equals: '2fa' },
      },
    });

    if (is2FAEnabled) {
      return HttpResponse.json({
        data: {
          startEnable2FA: {
            error: TWO_FACTOR_ALREADY_ENABLED_ERROR,
          },
        },
      });
    }

    const existingVerification = db.verification.findFirst({
      where: {
        target: { equals: user.email },
        type: { equals: '2fa-setup' },
      },
    });

    if (existingVerification) {
      db.verification.delete({
        where: {
          id: { equals: existingVerification.id },
        },
      });
    }

    db.verification.create({
      target: user.email,
      type: '2fa-setup',
    });

    return HttpResponse.json({
      data: {
        startEnable2FA: {
          transactionID: 'valid-transaction-id',
        },
      },
    });
  },
);
