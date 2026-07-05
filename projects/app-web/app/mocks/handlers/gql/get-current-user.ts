import { HttpResponse, graphql } from 'msw';
import type { GetCurrentUserQueryVariables, User } from '~/gql/graphql';
import { db } from '../../db';
import { decodeMockJWT } from '../../utils/decode-mock-jwt';
import { addUserResolvedFields } from './utils/add-user-resolved-fields';

type GetCurrentUserVariables = GetCurrentUserQueryVariables;

interface GetCurrentUserResponse {
  getCurrentUser: User;
}

export const GetCurrentUser = graphql.query<GetCurrentUserResponse, GetCurrentUserVariables>(
  'GetCurrentUser',
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
        errors: [{ message: 'Internal Server Error' }],
      });
    }

    return HttpResponse.json({
      data: {
        getCurrentUser: addUserResolvedFields(user),
      },
    });
  },
);
