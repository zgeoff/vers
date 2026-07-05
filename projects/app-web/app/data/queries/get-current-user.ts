import { graphql } from '../../gql';

export const GetCurrentUserQuery = graphql(/* GraphQL */ `
  query GetCurrentUser {
    getCurrentUser {
      id
      username
      name
      email
      is2FAEnabled
    }
  }
`);
