import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MigrationResultSet } from 'kysely/migration';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import { createDB } from './create-db';

/**
 * Absolute path to this package's kysely migrations. Shared by
 * `kysely.config.ts` and `migrateToLatest` so the CLI and the programmatic
 * entry point never point at different folders.
 */
export const migrationsFolder = path.join(import.meta.dirname, '../migrations');

interface MigrateToLatestConfig {
  databaseURL: string;
}

/**
 * Applies every pending kysely migration in `migrationsFolder`, in order.
 * The single programmatic composition point for dev resets and test-DB
 * setup — assumes the drizzle baseline (`db-postgres/migrations`) already
 * ran against the same database.
 */
export async function migrateToLatest(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  config: MigrateToLatestConfig,
): Promise<MigrationResultSet> {
  const db = createDB({ databaseURL: config.databaseURL });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      migrationFolder: migrationsFolder,
      path,
    }),
  });

  const migrationResultSet = await migrator.migrateToLatest();

  await db.destroy();

  return migrationResultSet;
}
