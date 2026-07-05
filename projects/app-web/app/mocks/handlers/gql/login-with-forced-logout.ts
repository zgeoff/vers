import { graphql, HttpResponse } from 'msw';
import invariant from 'tiny-invariant';
import type {
  LoginWithForcedLogoutInput,
  LoginWithForcedLogoutPayload,
} from '~/gql/graphql';
import { db } from '../../db';
import { UNKNOWN_ERROR } from '../../errors';
import { encodeMockJWT } from '../../utils/encode-mock-jwt';
import { addUserResolvedFields } from './utils/add-user-resolved-fields';
import { isValidTransactionToken } from './utils/is-valid-transaction-token';

interface LoginWithForcedLogoutVariables {
  input: LoginWithForcedLogoutInput;
}

interface LoginWithForcedLogoutResponse {
  loginWithForcedLogout: LoginWithForcedLogoutPayload;
}

const EXPIRATION_IN_MS = 1000 * 60 * 60 * 24; // 24 hours

export const LoginWithForcedLogout = graphql.mutation<
  LoginWithForcedLogoutResponse,
  LoginWithForcedLogoutVariables
>('LoginWithForcedLogout', ({ variables }) => {
  const { target, transactionToken } = variables.input;

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
        loginWithForcedLogout: {
          error: UNKNOWN_ERROR,
        },
      },
    });
  }

  if (!isValidTransactionToken(transactionToken)) {
    return HttpResponse.json({
      data: {
        loginWithForcedLogout: {
          error: UNKNOWN_ERROR,
        },
      },
    });
  }

  // this is hacky - as we don't have access to the pending session ID from our
  // transaction token, we just yeet all but the most recent session and pray
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

  db.session.deleteMany({
    where: {
      id: {
        in: prevSessions.map((session) => session.id),
      },
    },
  });

  const accessToken = encodeMockJWT({
    exp: Number.parseInt(
      (Date.now() + EXPIRATION_IN_MS).toString().slice(0, 10),
    ),
    sub: user.id,
  });

  return HttpResponse.json({
    data: {
      loginWithForcedLogout: {
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
