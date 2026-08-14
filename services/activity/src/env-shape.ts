import * as z from 'zod';

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
