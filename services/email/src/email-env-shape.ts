import * as z from 'zod';

/**
 * Environment the email service needs beyond the base service env: a database connection for the
 * job queue's default pg-boss pool, and the Resend credentials for the client jobs deliver
 * through.
 */
export const EMAIL_ENV_SHAPE = {
  DATABASE_URL: z.string(),
  EMAIL_FROM: z.string(),
  RESEND_API_KEY: z.string(),
};
