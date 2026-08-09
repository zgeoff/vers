import * as z from 'zod';

/**
 * Environment the activity service needs beyond the base service env: the checkpoint-store
 * database, the replay origin committed appends poke, the keys origin a start reads its scope
 * secret from, and the key its wake-poke and s2s tokens are signed with.
 */
export const envShape = {
  DATABASE_URL: z.string().describe('Postgres connection string for the activity checkpoint store'),
  KEYS_SERVICE_URL: z
    .url()
    .describe('Origin of the keys service a start reads its worldmap scope secret from'),
  REPLAY_SERVICE_URL: z
    .url()
    .describe('Origin of the replay service a committed append pokes to drain claimable work'),
  SERVICE_AUTH_PRIVATE_KEY: z
    .string()
    .min(1)
    .describe(
      'Ed25519 PKCS8 private key this service signs its replay wake-poke and keys s2s tokens with',
    ),
};
