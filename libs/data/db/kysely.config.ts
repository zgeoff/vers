import { CamelCasePlugin } from 'kysely';
import { defineConfig } from 'kysely-ctl';
import { buildMigrationDialect } from './src/build-migration-dialect';
import { migrationsFolder } from './src/build-migrator';

const databaseURL = process.env['DATABASE_URL'];

if (databaseURL === undefined) {
  throw new Error('DATABASE_URL must be set to run kysely-ctl');
}

export default defineConfig({
  dialect: buildMigrationDialect(databaseURL),
  migrations: {
    migrationFolder: migrationsFolder,
  },
  plugins: [new CamelCasePlugin()],
  seeds: {
    seedFolder: 'seeds',
  },
});
