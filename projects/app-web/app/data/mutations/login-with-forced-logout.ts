import { graphql } from '../../gql';

export const LoginWithForcedLogoutMutation = graphql(/* GraphQL */ `
  mutation LoginWithForcedLogout($input: LoginWithForcedLogoutInput!) {
    loginWithForcedLogout(input: $input) {
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
