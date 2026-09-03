import * as z from 'zod';

export const baseEnvSchema = z.object({
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info')
    .describe('Minimum pino log level the service emits'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z
    .url()
    .optional()
    .describe('OTLP collector endpoint; unset leaves every instrument a no-op'),
  PORT: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(3000)
    .describe('TCP port the HTTP server binds; 0 binds an OS-assigned port'),
  SENTRY_DSN: z.url().optional().describe('Bugsink project DSN; unset disables error reporting'),
  SERVICE_AUTH_JWKS: z
    .string()
    .min(1)
    .describe(
      'JSON JWKS holding each minting issuer public key under its kid; inbound s2s tokens only verify against the key registered for their claimed issuer',
    ),
});
