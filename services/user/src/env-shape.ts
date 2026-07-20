import * as z from 'zod';

/**
 * Environment the user service needs beyond the base service env: a database connection for the
 * account and credential tables.
 */
export const envShape = {
  DATABASE_URL: z
    .string()
    .describe('Postgres connection string for the account and credential tables'),
};
