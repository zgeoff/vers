import { HttpResponse, graphql } from 'msw';
import type { StartStepUpAuthInput, StartStepUpAuthPayload } from '~/gql/graphql';
import { db } from '../../db';
import { TWO_FACTOR_NOT_ENABLED_ERROR, UNKNOWN_ERROR } from '../../errors';
import { decodeMockJWT } from '../../utils/decode-mock-jwt';

interface StartStepUpAuthVariables {
  input: StartStepUpAuthInput;
}

interface StartStepUpAuthResponse {
  startStepUpAuth: StartStepUpAuthPayload;
}

export const StartStepUpAuth = graphql.mutation<StartStepUpAuthResponse, StartStepUpAuthVariables>(
  'StartStepUpAuth',
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
          startStepUpAuth: {
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

    if (!is2FAEnabled) {
      return HttpResponse.json({
        data: {
          startStepUpAuth: {
            error: TWO_FACTOR_NOT_ENABLED_ERROR,
          },
        },
      });
    }

    return HttpResponse.json({
      data: {
        startStepUpAuth: {
          transactionID: 'test_transaction_id',
        },
      },
    });
  },
);
