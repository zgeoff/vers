import { graphql } from '../../gql';

export const FinishLoginWith2FAMutation = graphql(/* GraphQL */ `
  mutation FinishLoginWith2FA($input: FinishLoginWith2FAInput!) {
    finishLoginWith2FA(input: $input) {
      ... on AuthPayload {
        accessToken
        refreshToken
        session {
          id
          expiresAt
        }
      }

      ... on ForceLogoutPayload {
        sessionID
        transactionToken
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
