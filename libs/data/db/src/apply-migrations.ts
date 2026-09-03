import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MigrationResultSet } from 'kysely/migration';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import { createDB } from './create-db';

export const migrationsFolder = path.join(import.meta.dirname, '../migrations');

interface ApplyMigrationsConfig {
  readonly databaseURL: string;
}

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
