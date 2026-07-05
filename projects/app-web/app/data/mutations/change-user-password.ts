import { graphql } from '../../gql';

export const ChangeUserPasswordMutation = graphql(/* GraphQL */ `
  mutation ChangeUserPassword($input: ChangeUserPasswordInput!) {
    changeUserPassword(input: $input) {
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
