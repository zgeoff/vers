import { graphql } from '../../gql';

export const FinishEnable2FAMutation = graphql(/* GraphQL */ `
  mutation FinishEnable2FA($input: FinishEnable2FAInput!) {
    finishEnable2FA(input: $input) {
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
