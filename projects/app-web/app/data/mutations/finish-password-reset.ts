import { graphql } from '../../gql';

export const FinishPasswordResetMutation = graphql(/* GraphQL */ `
  mutation FinishPasswordReset($input: FinishPasswordResetInput!) {
    finishPasswordReset(input: $input) {
      ... on MutationSuccess {
        success
      }

      ... on MutationErrorPayload {
        error {
          title
          message
        }
      }
    }
  }
`);
