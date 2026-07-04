import { CamelCasePlugin } from 'kysely';
import { defineConfig } from 'kysely-ctl';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';

/**
 * kysely-ctl config for the #159 spike. The dialect mirrors the runtime
 * choice (postgres.js), so migrations exercise the same driver the services
 * will use.
 */
export default defineConfig({
  dialect: new PostgresJSDialect({
    postgres: postgres(
      process.env.DATABASE_URL ?? 'postgres://spike:spike@localhost:55432/postgres',
      { max: 1, onnotice: () => {} },
    ),
  }),
  migrations: {
    migrationFolder: 'migrations',
  },
  plugins: [new CamelCasePlugin()],
  seeds: {
    seedFolder: 'seeds',
  },
});
