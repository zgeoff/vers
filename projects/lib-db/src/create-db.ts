import { CamelCasePlugin, Kysely } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';
import type { DB } from './schema.generated';

interface CreateDBConfig {
  readonly databaseURL: string;
}

/**
 * Builds a `Kysely` client over the shared postgres.js dialect with
 * camelCase-mapped columns. Callers own env parsing — this never reads
 * `process.env` itself.
 *
 * Both session-level timeouts below bound how long a single statement or an
 * idle-in-transaction connection can hold a lock: no future code path that
 * opens a transaction can leave orphaned transaction state alive past 30s,
 * even across a serverless process kill.
 */
export function createDB(config: CreateDBConfig): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresJSDialect({
      postgres: postgres(config.databaseURL, {
        connection: {
          idle_in_transaction_session_timeout: 30_000,
          statement_timeout: 30_000,
        },
      }),
    }),
    plugins: [new CamelCasePlugin()],
  });
}
