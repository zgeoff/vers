import * as z from 'zod';

/**
 * Environment the verification service needs beyond the base service env: a database connection
 * for verification rows.
 */
export const VERIFICATION_ENV_SHAPE = {
  DATABASE_URL: z.string(),
};
