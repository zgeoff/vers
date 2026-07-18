import * as z from 'zod';

/**
 * Environment the session service needs beyond the base service env: a database connection for
 * session rows, and the identity and key material user-token signing runs on.
 */
export const SESSION_ENV_SHAPE = {
  API_IDENTIFIER: z.string().describe('Issuer and audience stamped into signed user tokens'),
  DATABASE_URL: z.string(),
  JWT_SIGNING_PRIVKEY: z.string().describe('RS256 PKCS8 private key user tokens are signed with'),
};
