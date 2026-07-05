import { graphql } from '../../gql';

export const FinishChangeUserEmailMutation = graphql(/* GraphQL */ `
  mutation FinishChangeUserEmail($input: FinishChangeUserEmailInput!) {
    finishChangeUserEmail(input: $input) {
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
