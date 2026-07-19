import { LoggingSchema, NodeEnvSchema, expandEnv } from '@vers/service-utils';
import { z } from 'zod';

const envSchema = z.object({
  LOGGING: LoggingSchema.describe('Minimum log level the web server emits'),
  NODE_ENV: NodeEnvSchema.describe(
    'Runtime mode; production enables secure cookies and disables dev-only behavior',
  ),
  OTEL_EXPORTER_OTLP_ENDPOINT: z
    .url()
    .optional()
    .describe('OTLP collector endpoint; unset disables telemetry export'),
  SENTRY_DSN: z
    .url()
    .optional()
    .describe('Server-side Bugsink project DSN; unset disables server error reporting'),
  TINYBIRD_INGEST_TOKEN: z
    .string()
    .min(1)
    .optional()
    .describe('Append-scoped token for the product_events data source; unset disables delivery'),
  TINYBIRD_URL: z
    .url({ protocol: /^https$/ })
    .optional()
    .describe('Product-analytics Events API origin; unset disables delivery'),
  UMAMI_URL: z
    .url()
    .optional()
    .describe('Umami deployment the analytics proxy forwards beacons to'),
  VITE_SENTRY_DSN: z
    .url()
    .optional()
    .describe('Browser-bundle Bugsink DSN; unset ships no client error reporting'),
  SERVICE_AUTH_PRIVATE_KEY: z
    .string()
    .min(1)
    .describe('Ed25519 PKCS8 private key outbound s2s tokens are signed with'),
});

// `expandEnv` is plain-function generic, not zod-typed, so it stays reusable regardless of which
// zod produced its input.
export const env = expandEnv(envSchema.parse(process.env));
