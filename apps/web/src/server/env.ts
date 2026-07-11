import { addEnvUtils } from '@vers/service-utils';
import { z } from 'zod';

// `@vers/service-utils`'s own `LoggingSchema`/`NodeEnvSchema` are zod 3 schemas (this package's
// own catalog pin); this app is on zod 4, so the equivalent enums are declared locally rather than
// composed across the major-version boundary. `addEnvUtils` is plain-function generic, not
// zod-typed, so it stays reusable regardless of which zod produced its input.
const envSchema = z.object({
  LOGGING: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
  NODE_ENV: z.enum(['development', 'e2e', 'production', 'test']),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  SENTRY_DSN: z.url().optional(),
  VITE_SENTRY_DSN: z.url().optional(),
  SERVICE_AUTH_PRIVATE_KEY: z.string().min(1),
});

export const env = addEnvUtils(envSchema.parse(process.env));
