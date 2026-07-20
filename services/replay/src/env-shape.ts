import * as z from 'zod';

/**
 * Environment the replay service needs beyond the base service env: the database its worker
 * claims chains from, the keys origin the mint step resolves through, its outbound s2s signing
 * key, and the engine hash its build baked in.
 */
export const envShape = {
  DATABASE_URL: z.string().describe('Postgres connection string the worker claims chains from'),
  KEYS_SERVICE_URL: z
    .url()
    .describe('Origin of the keys service the mint step resolves roll keys through'),
  SERVICE_AUTH_PRIVATE_KEY: z
    .string()
    .min(1)
    .describe('Ed25519 PKCS8 private key the worker signs outbound s2s tokens with'),
  SIM_ENGINE_HASH: z
    .string()
    .min(1)
    .describe('Engine hash baked at build; the provider answers replay only for this version'),
};
