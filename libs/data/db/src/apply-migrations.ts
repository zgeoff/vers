import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MigrationResultSet } from 'kysely/migration';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import { createDB } from './create-db';

/**
 * Absolute path to this package's kysely migrations. Shared by
 * `kysely.config.ts` and this package's programmatic migration runner so the
 * CLI and the programmatic entry point never point at different folders.
 */
export const migrationsFolder = path.join(import.meta.dirname, '../migrations');

interface ApplyMigrationsConfig {
  readonly databaseURL: string;
}

/**
 * Applies every pending kysely migration in `migrationsFolder`, in order,
 * starting from an empty database. The single programmatic composition
 * point for dev resets and test-DB setup.
 */
export async function applyMigrations(config: ApplyMigrationsConfig): Promise<MigrationResultSet> {
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
