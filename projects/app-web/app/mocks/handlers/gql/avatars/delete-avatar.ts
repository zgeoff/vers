import { HttpResponse, graphql } from 'msw';
import type { DeleteAvatarInput, DeleteAvatarPayload } from '../../../../gql/graphql';
import { db } from '../../../db';
import { decodeMockJWT } from '../../../utils/decode-mock-jwt';

interface DeleteAvatarVariables {
  input: DeleteAvatarInput;
}

interface DeleteAvatarResponse {
  deleteAvatar: DeleteAvatarPayload;
}

export const DeleteAvatar = graphql.mutation<DeleteAvatarResponse, DeleteAvatarVariables>(
  'DeleteAvatar',
  (opts) => {
    const authHeader = opts.request.headers.get('authorization');

    // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
    if (!authHeader) {
      return HttpResponse.json({
        errors: [{ message: 'Unauthorized' }],
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = decodeMockJWT(token);

    db.avatar.delete({
      where: {
        id: { equals: opts.variables.input.id },
        userID: { equals: payload.sub },
      },
    });

    return HttpResponse.json({
      data: {
        deleteAvatar: {
          success: true,
        },
      },
    });
  },
);
