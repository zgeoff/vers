import { graphql } from '../../gql';

export const RefreshAccessTokenMutation = graphql(/* GraphQL */ `
  mutation RefreshAccessToken($input: RefreshAccessTokenInput!) {
    refreshAccessToken(input: $input) {
      ... on TokenPayload {
        accessToken
        refreshToken
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
