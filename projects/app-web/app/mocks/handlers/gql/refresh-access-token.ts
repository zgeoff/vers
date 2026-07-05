import { HttpResponse, graphql } from 'msw';
import type { RefreshAccessTokenInput, RefreshAccessTokenPayload } from '~/gql/graphql';
import { db } from '../../db';
import { UNKNOWN_ERROR } from '../../errors';
import { encodeMockJWT } from '../../utils/encode-mock-jwt';

interface RefreshAccessTokenVariables {
  input: RefreshAccessTokenInput;
}

interface RefreshAccessTokenResponse {
  refreshAccessToken: RefreshAccessTokenPayload;
}

const EXPIRATION_IN_S = 60 * 60 * 24; // 1 day

export const RefreshAccessToken = graphql.mutation<
  RefreshAccessTokenResponse,
  RefreshAccessTokenVariables
>('RefreshAccessToken', (opts) => {
  const session = db.session.findFirst({
    where: {
      refreshToken: {
        equals: opts.variables.input.refreshToken,
      },
    },
  });

  if (!session) {
    return HttpResponse.json({
      data: {
        refreshAccessToken: {
          error: UNKNOWN_ERROR,
        },
      },
    });
  }

  const user = db.user.findFirst({
    where: {
      id: {
        equals: session.userID,
      },
    },
  });

  if (!user) {
    return HttpResponse.json({
      data: {
        refreshAccessToken: {
          error: UNKNOWN_ERROR,
        },
      },
    });
  }

  const accessToken = encodeMockJWT({
    exp: Math.floor(Date.now() / 1000) + EXPIRATION_IN_S,
    sub: user.id,
  });

  return HttpResponse.json({
    data: {
      refreshAccessToken: {
        accessToken,
        refreshToken: session.refreshToken,
      },
    },
  });
});
