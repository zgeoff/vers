import * as z from 'zod';

/**
 * Environment the avatar service needs beyond the base service env: a database connection for
 * avatar rows and progression.
 */
export const AVATAR_ENV_SHAPE = {
  DATABASE_URL: z.string(),
};
