import { graphql, HttpResponse } from 'msw';
import type { DeleteSessionInput, DeleteSessionPayload } from '~/gql/graphql';
import { db } from '../../db';

interface DeleteSessionVariables {
  input: DeleteSessionInput;
}

interface DeleteSessionResponse {
  deleteSession: DeleteSessionPayload;
}

export const DeleteSession = graphql.mutation<
  DeleteSessionResponse,
  DeleteSessionVariables
>('DeleteSession', ({ variables }) => {
  db.session.delete({
    where: {
      id: {
        equals: variables.input.id,
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
});
