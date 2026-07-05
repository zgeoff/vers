import { HttpResponse, graphql } from 'msw';
import type {
  ChangeUserPasswordMutation,
  ChangeUserPasswordMutationVariables,
} from '../../../gql/graphql';
import { db } from '../../db';
import { INVALID_PASSWORD_ERROR } from '../../errors';
import { decodeMockJWT } from '../../utils/decode-mock-jwt';

export const ChangeUserPassword = graphql.mutation<
  ChangeUserPasswordMutation,
  ChangeUserPasswordMutationVariables
>('ChangeUserPassword', (opts) => {
  const authHeader = opts.request.headers.get('authorization');

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
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
      data: {
        changeUserPassword: {
          error: INVALID_PASSWORD_ERROR,
        },
      },
    });
  }

  if (user.password !== opts.variables.input.currentPassword) {
    return HttpResponse.json({
      data: {
        changeUserPassword: { error: INVALID_PASSWORD_ERROR },
      },
    });
  }

  db.user.update({
    data: { password: opts.variables.input.newPassword },
    where: { id: { equals: user.id } },
  });

  return HttpResponse.json({
    data: {
      changeUserPassword: {
        success: true,
      },
    },
  });
});
