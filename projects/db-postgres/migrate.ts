import * as Sentry from '@sentry/node';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './src/db';
import { pg } from './src/pg';

Sentry.init({
  ...(process.env['SENTRY_DSN'] !== undefined && {
    dsn: process.env['SENTRY_DSN'],
  }),
});

try {
  await migrate(db, { migrationsFolder: './migrations' });
} catch (error) {
  Sentry.captureException(error);
  console.error(error);
} finally {
  await pg.end();
}
