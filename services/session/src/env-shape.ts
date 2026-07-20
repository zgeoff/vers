import * as z from 'zod';

/**
 * Environment the session service needs beyond the base service env: the session and step-up
 * tables' database, plus the identity and key its user tokens are signed with.
 */
export const envShape = {
  API_IDENTIFIER: z.string().describe('Issuer and audience stamped into signed user tokens'),
  DATABASE_URL: z
    .string()
    .describe('Postgres connection string for the session and step-up tables'),
  JWT_SIGNING_PRIVKEY: z.string().describe('RS256 PKCS8 private key user tokens are signed with'),
};
