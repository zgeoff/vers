import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';

export function buildMigrationDialect(databaseURL: string): PostgresJSDialect {
  // no session timeouts or query deadline, unlike a service connection: an index build, backfill
  // or lock wait in a migration may run for minutes, and a cut-off one fails the deploy
  return new PostgresJSDialect({
    postgres: postgres(databaseURL, { max: 1, onnotice: () => {} }),
  });
}
