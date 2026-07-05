import { LoggingSchema, NodeEnvSchema, addEnvUtils } from '@vers/service-utils';
import { z } from 'zod';

export const envSchema = z
  .object({
    API_IDENTIFIER: z.string(),
    APP_WEB_URL: z.string().url(),
    HOSTNAME: z.string(),
    JWT_SIGNING_PRIVKEY: z.string().transform((value) => value.replaceAll(String.raw`\n`, '\n')),
    JWT_SIGNING_PUBKEY: z.string().transform((value) => value.replaceAll(String.raw`\n`, '\n')),
    LOGGING: LoggingSchema,
    NODE_ENV: NodeEnvSchema,
    PORT: z.string().transform(Number),
    SENTRY_DSN: z.string().url().optional(),

    // service URLs
    AVATARS_SERVICE_URL: z.string().url(),
    EMAILS_SERVICE_URL: z.string().url(),
    SESSIONS_SERVICE_URL: z.string().url(),
    USERS_SERVICE_URL: z.string().url(),
    VERIFICATIONS_SERVICE_URL: z.string().url(),
  })
  .transform(addEnvUtils);

export const env = envSchema.parse(process.env);
