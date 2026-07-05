import { HttpResponse, graphql } from 'msw';
import type { StartPasswordResetInput, StartPasswordResetPayload } from '~/gql/graphql';
import { db } from '../../db';

interface StartPasswordResetVariables {
  input: StartPasswordResetInput;
}

interface StartPasswordResetResponse {
  startPasswordReset: StartPasswordResetPayload;
}

export const StartPasswordReset = graphql.mutation<
  StartPasswordResetResponse,
  StartPasswordResetVariables
>('StartPasswordReset', (opts) => {
  const user = db.user.findFirst({
    where: {
      email: { equals: opts.variables.input.email },
    },
  });

  // return a success response as to avoid user enumeration if the user doesn't exist
  if (!user) {
    return HttpResponse.json({
      data: {
        startPasswordReset: {
          success: true,
        },
      },
    });
  }

  return HttpResponse.json({
    data: {
      startPasswordReset: {
        success: true,
      },
    },
  });
});
