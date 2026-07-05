import { HttpResponse, graphql } from 'msw';
import invariant from 'tiny-invariant';
import type { FinishLoginWith2FaInput, FinishLoginWith2FaPayload } from '~/gql/graphql';
import { db } from '../../db';
import { UNKNOWN_ERROR } from '../../errors';
import { encodeMockJWT } from '../../utils/encode-mock-jwt';
import { addUserResolvedFields } from './utils/add-user-resolved-fields';
import { isValidTransactionToken } from './utils/is-valid-transaction-token';

interface FinishLoginWith2FAVariables {
  input: FinishLoginWith2FaInput;
}

interface FinishLoginWith2FAResponse {
  finishLoginWith2FA: FinishLoginWith2FaPayload;
}

const EXPIRATION_IN_MS = 1000 * 60 * 60 * 24; // 24 hours

export const FinishLoginWith2FA = graphql.mutation<
  FinishLoginWith2FAResponse,
  FinishLoginWith2FAVariables
>('FinishLoginWith2FA', (opts) => {
  const { target, transactionToken } = opts.variables.input;

  const user = db.user.findFirst({
    where: {
      email: {
        equals: target,
      },
    },
  });

  if (!user) {
    return HttpResponse.json({
      data: {
        finishLoginWith2FA: {
          error: UNKNOWN_ERROR,
        },
      },
    });
  }

  if (!isValidTransactionToken(transactionToken)) {
    return HttpResponse.json({
      data: {
        finishLoginWith2FA: {
          error: UNKNOWN_ERROR,
        },
      },
    });
  }

  // this is hacky - in our real server we store the pending session ID in the
  // transaction token, but to avoid all that complexity we just grab the most
  // recent session and treat it as our pending one.
  const sessions = db.session.findMany({
    orderBy: {
      createdAt: 'asc',
    },
    where: {
      userID: {
        equals: user.id,
      },
    },
  });

  const [session, ...prevSessions] = sessions;

  invariant(session, 'session must exist');

  if (prevSessions.length > 0) {
    return HttpResponse.json({
      data: {
        finishLoginWith2FA: {
          sessionID: session.id,
          transactionToken: 'valid_transaction_token',
        },
      },
    });
  }

  const expSeconds = (Date.now() + EXPIRATION_IN_MS).toString().slice(0, 10);

  const accessToken = encodeMockJWT({
    exp: Number(expSeconds),
    sub: user.id,
  });

  return HttpResponse.json({
    data: {
      finishLoginWith2FA: {
        accessToken,
        refreshToken: session.refreshToken,
        session: {
          ...session,
          user: addUserResolvedFields(user),
        },
      },
    },
  });
});
