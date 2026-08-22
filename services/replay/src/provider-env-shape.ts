import * as z from 'zod';

/**
 * Environment the provider entrypoint needs beyond the base service env: only the engine hash its
 * build baked in. No database, keys service, or signing key — a provider machine serves
 * `replaySegment` in-process against its own baked engine and never claims a seed chain or
 * dispatches cross-version.
 */
export const providerEnvShape = {
  SIM_ENGINE_HASH: z
    .string()
    .min(1)
    .describe('Engine hash baked at build; the provider answers replay only for this version'),
};
