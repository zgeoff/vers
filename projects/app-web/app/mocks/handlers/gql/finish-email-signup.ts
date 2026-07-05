import { graphql, HttpResponse } from 'msw';
import type {
  FinishEmailSignupInput,
  FinishEmailSignupPayload,
} from '~/gql/graphql';
import { db } from '../../db';
import { UNKNOWN_ERROR } from '../../errors';
import { encodeMockJWT } from '../../utils/encode-mock-jwt';
import { addUserResolvedFields } from './utils/add-user-resolved-fields';

interface FinishEmailSignupVariables {
  input: FinishEmailSignupInput;
}

interface FinishEmailSignupResponse {
  finishEmailSignup: FinishEmailSignupPayload;
}

const EXPIRATION_IN_MS = 1000 * 60 * 60 * 24; // 1 day

export const FinishEmailSignup = graphql.mutation<
  FinishEmailSignupResponse,
  FinishEmailSignupVariables
>('FinishEmailSignup', ({ variables }) => {
  const existingUser = db.user.findFirst({
    where: { email: { equals: variables.input.email } },
  });

  if (existingUser) {
    return HttpResponse.json({
      data: {
        finishEmailSignup: {
          error: UNKNOWN_ERROR,
        },
      },
    });
  }

  const user = db.user.create({
    email: variables.input.email,
    name: variables.input.name,
    password: variables.input.password,
    username: variables.input.username,
  });

  const session = db.session.create({
    userID: user.id,
  });

  const accessToken = encodeMockJWT({
    exp: Date.now() + EXPIRATION_IN_MS,
    sub: user.id,
  });

  const finishEmailSignup: FinishEmailSignupPayload = {
    accessToken,
    refreshToken: session.refreshToken,
    session: {
      ...session,
      user: addUserResolvedFields(user),
    },
  };

  return HttpResponse.json({ data: { finishEmailSignup } });
});
