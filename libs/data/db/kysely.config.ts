import { CamelCasePlugin } from 'kysely';
import { defineConfig } from 'kysely-ctl';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';
import { migrationsFolder } from './src/apply-migrations';

const databaseURL = process.env['DATABASE_URL'];

if (databaseURL === undefined) {
  throw new Error('DATABASE_URL must be set to run kysely-ctl');
}

export default defineConfig({
  dialect: new PostgresJSDialect({
    postgres: postgres(databaseURL, { max: 1, onnotice: () => {} }),
  }),
  migrations: {
    migrationFolder: migrationsFolder,
  },
  plugins: [new CamelCasePlugin()],
  seeds: {
    seedFolder: 'seeds',
  },
});
