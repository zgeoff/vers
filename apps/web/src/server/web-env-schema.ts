import { z } from 'zod';

/**
 * The web app's env contract, parse-free so tooling can read it without touching `process.env`.
 * `@vers/service-utils`'s own `LoggingSchema`/`NodeEnvSchema` are zod 3 schemas (that package's
 * own catalog pin); this app is on zod 4, so the equivalent enums are declared locally rather
 * than composed across the major-version boundary.
 */
export const WEB_ENV_SCHEMA = z.object({
  LOGGING: z
    .enum(['debug', 'info', 'warn', 'error'])
    .optional()
    .default('info')
    .describe('Minimum log level the web server emits'),
  NODE_ENV: z
    .enum(['development', 'e2e', 'production', 'test'])
    .describe('Runtime mode; production enables secure cookies and disables dev-only behavior'),
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
