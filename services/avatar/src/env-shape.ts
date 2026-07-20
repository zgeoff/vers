import * as z from 'zod';

/**
 * Environment the avatar service needs beyond the base service env: a database connection for the
 * avatar and progression tables.
 */
export const envShape = {
  DATABASE_URL: z
    .string()
    .describe('Postgres connection string for the avatar and progression tables'),
};
