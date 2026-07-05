import { HttpResponse, graphql } from 'msw';
import type { DeleteSessionInput, DeleteSessionPayload } from '~/gql/graphql';
import { db } from '../../db';

interface DeleteSessionVariables {
  input: DeleteSessionInput;
}

interface DeleteSessionResponse {
  deleteSession: DeleteSessionPayload;
}

export const DeleteSession = graphql.mutation<DeleteSessionResponse, DeleteSessionVariables>(
  'DeleteSession',
  (opts) => {
    db.session.delete({
      where: {
        id: {
          equals: opts.variables.input.id,
        },
      },
    });

    return HttpResponse.json({
      data: {
        deleteSession: {
          success: true,
        },
      },
    });
  },
);
