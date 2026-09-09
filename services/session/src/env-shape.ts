import * as z from 'zod';

export const envShape = {
  API_IDENTIFIER: z.string().describe('Issuer and audience stamped into signed user tokens'),
  DATABASE_URL: z
    .string()
    .describe('Postgres connection string for the session and step-up tables'),
  JWT_SIGNING_PRIVKEY: z.string().describe('RS256 PKCS8 private key user tokens are signed with'),
  JWT_SIGNING_RETIRED_PUBKEY: z
    .string()
    .optional()
    .describe(
      'SPKI public key of the previous signing key, published through the rotation overlap so tokens minted before the rotation still verify',
    ),
};
