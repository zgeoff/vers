import type * as schema from '@vers/postgres-schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { z } from 'zod';
import type { envSchema } from './env';

export type Env = z.infer<typeof envSchema>;

export interface HandlerContext {
  db: PostgresJsDatabase<typeof schema>;
}
