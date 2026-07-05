import { graphql } from '../../gql';

export const StartEmailSignupMutation = graphql(/* GraphQL */ `
  mutation StartEmailSignup($input: StartEmailSignupInput!) {
    startEmailSignup(input: $input) {
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
