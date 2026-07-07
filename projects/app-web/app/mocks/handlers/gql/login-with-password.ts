import { HttpResponse, graphql } from 'msw';
import type { LoginWithPasswordInput, LoginWithPasswordPayload } from '../../../gql/graphql';
import { db } from '../../db';
import { INVALID_CREDENTIALS_ERROR } from '../../errors';
import { encodeMockJWT } from '../../utils/encode-mock-jwt';
import { addUserResolvedFields } from './utils/add-user-resolved-fields';

interface LoginWithPasswordVariables {
  input: LoginWithPasswordInput;
}

interface LoginWithPasswordResponse {
  loginWithPassword: LoginWithPasswordPayload;
}

const EXPIRATION_IN_MS = 1000 * 60 * 60 * 24; // 24 hours

export const LoginWithPassword = graphql.mutation<
  LoginWithPasswordResponse,
  LoginWithPasswordVariables
>('LoginWithPassword', (opts) => {
  const user = db.user.findFirst({
    where: {
      email: {
        equals: opts.variables.input.email,
      },
    },
  });

  if (!user) {
    return HttpResponse.json({
      data: {
        loginWithPassword: {
          error: INVALID_CREDENTIALS_ERROR,
        },
      },
    });
  }

  if (user.password !== opts.variables.input.password) {
    return HttpResponse.json({
      data: {
        loginWithPassword: {
          error: INVALID_CREDENTIALS_ERROR,
        },
      },
    });
  }

  const prevSessions = db.session.findMany({
    where: {
      userID: {
        equals: user.id,
      },
    },
  });

  const session = db.session.create({
    userID: user.id,
    verified: false,
  });

  const is2FAEnabled = db.verification.findFirst({
    where: {
      target: { equals: opts.variables.input.email },
      type: { equals: '2fa' },
    },
  });

  if (is2FAEnabled) {
    return HttpResponse.json({
      data: {
        loginWithPassword: {
          sessionID: session.id,
          transactionID: 'transaction_id',
        },
      },
    });
  }

  if (prevSessions.length > 0) {
    return HttpResponse.json({
      data: {
        loginWithPassword: {
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
      loginWithPassword: {
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
