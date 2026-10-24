import type { MigrationResultSet } from 'kysely/migration';
import { buildMigrator } from './build-migrator';
import { createDB } from './create-db';

interface ApplyMigrationsConfig {
  readonly databaseURL: string;
}

export async function applyMigrations(config: ApplyMigrationsConfig): Promise<MigrationResultSet> {
  const db = createDB({ databaseURL: config.databaseURL });

  try {
    return await buildMigrator(db).migrateToLatest();
  } finally {
    await db.destroy();
  }
}
