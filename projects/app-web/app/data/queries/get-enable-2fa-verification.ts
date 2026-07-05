import { graphql } from '../../gql';

export const GetEnable2FAVerificationQuery = graphql(/* GraphQL */ `
  query GetEnable2FAVerification {
    getEnable2FAVerification {
      otpURI
    }
  }
`);
