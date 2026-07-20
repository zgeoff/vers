import * as z from 'zod';

/**
 * Environment the verification service needs beyond the base service env: a database connection
 * for the verification rows.
 */
export const envShape = {
  DATABASE_URL: z.string().describe('Postgres connection string for the verification rows'),
};
