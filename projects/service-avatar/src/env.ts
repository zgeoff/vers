import { LoggingSchema, NodeEnvSchema, addEnvUtils } from '@vers/service-utils';
import { z } from 'zod';

export const envSchema = z
  .object({
    API_IDENTIFIER: z.string(),
    DATABASE_URL: z.string(),
    HOSTNAME: z.string(),
    LOGGING: LoggingSchema,
    NODE_ENV: NodeEnvSchema,
    PORT: z.string().transform(Number),
    SENTRY_DSN: z.string().url().optional(),
  })
  .transform(addEnvUtils);

export const env = envSchema.parse(process.env);
