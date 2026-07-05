import { HttpResponse, graphql } from 'msw';
import type { StartEmailSignupInput, StartEmailSignupPayload } from '~/gql/graphql';
import { db } from '../../db';

interface StartEmailSignupVariables {
  input: StartEmailSignupInput;
}

interface StartEmailSignupResponse {
  startEmailSignup: StartEmailSignupPayload;
}

export const StartEmailSignup = graphql.mutation<
  StartEmailSignupResponse,
  StartEmailSignupVariables
>('StartEmailSignup', (opts) => {
  const existingUser = db.user.findFirst({
    where: { email: { equals: opts.variables.input.email } },
  });

  // return a success response as to avoid user enumeration the user doesn't exist
  if (existingUser) {
    return HttpResponse.json({
      data: {
        startEmailSignup: {
          transactionID: 'valid-transaction-id',
        },
      },
    });
  }

  db.verification.create({
    target: opts.variables.input.email,
    type: 'onboarding',
  });

  return HttpResponse.json({
    data: {
      startEmailSignup: {
        transactionID: 'valid-transaction-id',
      },
    },
  });
});
