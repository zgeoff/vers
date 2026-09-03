import * as z from 'zod';

export const providerEnvShape = {
  SIM_ENGINE_HASH: z
    .string()
    .min(1)
    .describe('Engine hash baked at build; the provider answers replay only for this version'),
};
