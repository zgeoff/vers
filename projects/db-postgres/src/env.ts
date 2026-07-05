import { LoggingSchema, NodeEnvSchema, addEnvUtils } from '@vers/service-utils';
import { z } from 'zod';

export const envSchema = z
  .object({
    DATABASE_URL: z.string(),
    LOGGING: LoggingSchema,
    NODE_ENV: NodeEnvSchema,
  })
  .transform(addEnvUtils);

export const env = envSchema.parse(process.env);
