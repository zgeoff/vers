import * as z from 'zod';

/**
 * Environment variables every service validates at boot, before any service-specific ones.
 */
export const BASE_ENV_SCHEMA = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),

  /**
   * `0` binds an OS-assigned ephemeral port, as `Bun.serve` interprets it — a real second instance
   * under test listens without claiming a fixed port.
   */
  PORT: z.coerce.number().int().nonnegative().default(3000),
  SENTRY_DSN: z.url().optional(),
  SERVICE_AUTH_PUBLIC_KEY: z.string().min(1),
});
