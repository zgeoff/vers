import { HttpResponse, graphql } from 'msw';
import { resolveGQLEnumFromClass } from '../../../../data/utils/resolve-gql-enum-from-class';
import type { Avatar, GetAvatarInput } from '../../../../gql/graphql';
import { db } from '../../../db';
import { decodeMockJWT } from '../../../utils/decode-mock-jwt';
import { resolveUserByID } from '../utils/resolve-user-by-id';

interface GetAvatarVariables {
  input: GetAvatarInput;
}

interface GetAvatarResponse {
  getAvatar: Avatar | null;
}

export const GetAvatar = graphql.query<GetAvatarResponse, GetAvatarVariables>(
  'GetAvatar',
  (opts) => {
    const authHeader = opts.request.headers.get('authorization');

    if (!authHeader) {
      return HttpResponse.json({
        errors: [{ message: 'Unauthorized' }],
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = decodeMockJWT(token);

    const avatar = db.avatar.findFirst({
      where: {
        id: { equals: opts.variables.input.id },
        userID: { equals: payload.sub },
      },
    });

    if (!avatar) {
      return HttpResponse.json({
        data: {
          getAvatar: null,
        },
      });
    }

    return HttpResponse.json({
      data: {
        getAvatar: {
          ...avatar,
          class: resolveGQLEnumFromClass(avatar.class),
          user: resolveUserByID(avatar.userID),
        },
      },
    });
  },
);
