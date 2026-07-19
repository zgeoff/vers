import * as z from 'zod';

/**
 * Environment the activity service needs beyond the base service env: a database connection for
 * the activity event store.
 */
export const ACTIVITY_ENV_SHAPE = {
  DATABASE_URL: z.string().describe('Postgres connection string for the activity checkpoint store'),
};
