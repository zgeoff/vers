import * as z from 'zod';

/**
 * Environment the replay service needs beyond the base service env: the database the worker
 * claims chains from, the keys service it resolves roll keys through, the private half of the s2s
 * keypair its worker signs outbound calls with, and the engine hash baked at build.
 */
export const REPLAY_SERVICE_ENV_SHAPE = {
  DATABASE_URL: z.string(),
  KEYS_SERVICE_URL: z.url(),
  SERVICE_AUTH_PRIVATE_KEY: z
    .string()
    .min(1)
    .describe('Ed25519 PKCS8 private key the worker signs outbound s2s tokens with'),
  SIM_ENGINE_HASH: z
    .string()
    .min(1)
    .describe('Engine hash baked at build; the provider answers replay only for this version'),
};
