import { CamelCasePlugin } from 'kysely';
import { defineConfig } from 'kysely-ctl';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';

const databaseURL = process.env['DATABASE_URL'];

if (databaseURL === undefined) {
  throw new Error('DATABASE_URL must be set to run kysely-ctl');
}

/**
 * kysely-ctl config for `@vers/db`'s migrations, seeds, and CLI commands
 * (`db:migrate`, `db:migrate:make`, `db:rollback`, `db:seed`). The dialect
 * mirrors `createDB`'s runtime choice (postgres.js), so migrations exercise
 * the same driver services use.
 */
export default defineConfig({
  dialect: new PostgresJSDialect({
    postgres: postgres(databaseURL, { max: 1, onnotice: () => {} }),
  }),
  migrations: {
    migrationFolder: 'migrations',
  },
  plugins: [new CamelCasePlugin()],
  seeds: {
    seedFolder: 'seeds',
  },
});
