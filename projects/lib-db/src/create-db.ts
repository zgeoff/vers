import { CamelCasePlugin, Kysely } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';
import type { DB } from './schema.generated';

interface CreateDBConfig {
  databaseURL: string;
}

/**
 * Builds a `Kysely` client over the shared postgres.js dialect with
 * camelCase-mapped columns. Callers own env parsing — this never reads
 * `process.env` itself.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function createDB(config: CreateDBConfig): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresJSDialect({
      postgres: postgres(config.databaseURL),
    }),
    plugins: [new CamelCasePlugin()],
  });
}
