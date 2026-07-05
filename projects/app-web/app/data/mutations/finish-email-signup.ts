import { graphql } from '../../gql';

export const FinishEmailSignupMutation = graphql(/* GraphQL */ `
  mutation FinishEmailSignup($input: FinishEmailSignupInput!) {
    finishEmailSignup(input: $input) {
      ... on AuthPayload {
        accessToken
        refreshToken
        session {
          id
          expiresAt
        }
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
