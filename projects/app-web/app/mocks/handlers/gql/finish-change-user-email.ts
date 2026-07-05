import { HttpResponse, graphql } from 'msw';
import type { FinishChangeUserEmailInput, FinishChangeUserEmailPayload } from '~/gql/graphql';
import { db } from '../../db';
import { UNKNOWN_ERROR } from '../../errors';
import { decodeMockJWT } from '../../utils/decode-mock-jwt';
import { isValidTransactionToken } from './utils/is-valid-transaction-token';

interface FinishChangeUserEmailVariables {
  input: FinishChangeUserEmailInput;
}

interface FinishChangeUserEmailResponse {
  finishChangeUserEmail: FinishChangeUserEmailPayload;
}

export const FinishChangeUserEmail = graphql.mutation<
  FinishChangeUserEmailResponse,
  FinishChangeUserEmailVariables
>('FinishChangeUserEmail', (opts) => {
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
        finishChangeUserEmail: {
          error: UNKNOWN_ERROR,
        },
      },
    });
  }

  if (!isValidTransactionToken(opts.variables.input.transactionToken)) {
    return HttpResponse.json({
      data: {
        finishChangeUserEmail: {
          error: UNKNOWN_ERROR,
        },
      },
    });
  }

  db.user.update({
    data: { email: opts.variables.input.email },
    where: { id: { equals: user.id } },
  });

  return HttpResponse.json({
    data: {
      finishChangeUserEmail: {
        success: true,
      },
    },
  });
});
