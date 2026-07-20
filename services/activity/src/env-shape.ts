import * as z from 'zod';

/**
 * Environment the activity service needs beyond the base service env: the checkpoint-store
 * database, the replay origin committed appends poke, and the key its wake-poke tokens are signed
 * with.
 */
export const envShape = {
  DATABASE_URL: z.string().describe('Postgres connection string for the activity checkpoint store'),
  REPLAY_SERVICE_URL: z
    .url()
    .describe('Origin of the replay service a committed append pokes to drain claimable work'),
  SERVICE_AUTH_PRIVATE_KEY: z
    .string()
    .min(1)
    .describe('Ed25519 PKCS8 private key this service signs its replay wake-poke tokens with'),
};
