import { graphql } from '../../gql';

export const DeleteSessionMutation = graphql(/* GraphQL */ `
  mutation DeleteSession($input: DeleteSessionInput!) {
    deleteSession(input: $input) {
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
