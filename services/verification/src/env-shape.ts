import * as z from 'zod';

export const envShape = {
  DATABASE_URL: z.string().describe('Postgres connection string for the verification rows'),
};
