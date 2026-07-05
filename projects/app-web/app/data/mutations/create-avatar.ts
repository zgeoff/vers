import { graphql } from '../../gql';

export const CreateAvatarMutation = graphql(/* GraphQL */ `
  mutation CreateAvatar($input: CreateAvatarInput!) {
    createAvatar(input: $input) {
      ... on Avatar {
        id
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
