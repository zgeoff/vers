import { graphql } from '../../gql';

export const StartChangeUserEmailMutation = graphql(/* GraphQL */ `
  mutation StartChangeUserEmail($input: StartChangeUserEmailInput!) {
    startChangeUserEmail(input: $input) {
      ... on VerificationRequiredPayload {
        transactionID
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
