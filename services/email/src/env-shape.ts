import * as z from 'zod';

export const envShape = {
  DATABASE_URL: z.string().describe('Postgres connection string backing the pg-boss job queue'),
  EMAIL_FROM: z.string().describe('From address on delivered transactional email'),
  RESEND_API_KEY: z.string().describe('Resend API key the delivery jobs authenticate with'),
};
