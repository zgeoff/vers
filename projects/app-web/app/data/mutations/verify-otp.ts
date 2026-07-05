import { graphql } from '../../gql';

export const VerifyOTPMutation = graphql(/* GraphQL */ `
  mutation VerifyOTP($input: VerifyOTPInput!) {
    verifyOTP(input: $input) {
      ... on TwoFactorSuccessPayload {
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
