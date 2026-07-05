import { LoggingSchema, NodeEnvSchema, addEnvUtils } from '@vers/service-utils';
import { z } from 'zod';

export const envSchema = z
  .object({
    API_IDENTIFIER: z.string(),
    HOSTNAME: z.string(),
    LOGGING: LoggingSchema,
    NODE_ENV: NodeEnvSchema,
    PORT: z.string().transform(Number),
    RESEND_API_KEY: z.string(),
    SENTRY_DSN: z.string().url().optional(),
  })
  .transform(addEnvUtils);

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
