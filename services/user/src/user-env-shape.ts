import * as z from 'zod';

/**
 * Environment the user service needs beyond the base service env: a database connection for
 * account rows.
 */
export const USER_ENV_SHAPE = {
  DATABASE_URL: z.string(),
};
