import * as z from 'zod';

/**
 * Environment the email service needs beyond the base service env: a database connection for the
 * job queue's default pg-boss pool, and the Resend credentials for the client jobs deliver
 * through.
 */
export const envShape = {
  DATABASE_URL: z.string().describe('Postgres connection string backing the pg-boss job queue'),
  EMAIL_FROM: z.string().describe('From address on delivered transactional email'),
  RESEND_API_KEY: z.string().describe('Resend API key the delivery jobs authenticate with'),
};
