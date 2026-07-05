import { graphql } from '../../gql';

export const FinishDisable2FAMutation = graphql(/* GraphQL */ `
  mutation FinishDisable2FA($input: FinishDisable2FAInput!) {
    finishDisable2FA(input: $input) {
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
