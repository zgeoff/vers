import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../../projects/lib-postgres-schema/src/index';
import { pg } from './pg';

export const db = drizzle(pg, { schema });
