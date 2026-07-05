import { graphql } from '../../gql';

export const GetAvatarsQuery = graphql(/* GraphQL */ `
  query GetAvatars($input: GetAvatarsInput!) {
    getAvatars(input: $input) {
      id
      name
      class
      level
      xp
      createdAt
    }
  }
`);
