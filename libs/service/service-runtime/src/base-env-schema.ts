import * as z from 'zod';

/**
 * Environment variables every service validates at boot, before any service-specific ones.
 */
export const BASE_ENV_SCHEMA = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),

  PORT: z.coerce.number().int().positive().default(3000),
  SENTRY_DSN: z.url().optional(),
  SERVICE_AUTH_PUBLIC_KEY: z
    .string()
    .min(1)
    .describe('Ed25519 SPKI public key inbound s2s tokens are verified against'),
});
