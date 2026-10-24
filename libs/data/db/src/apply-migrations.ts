import type { MigrationResultSet } from 'kysely/migration';
import { buildMigrationDB } from './build-migration-db';
import { buildMigrator } from './build-migrator';

interface ApplyMigrationsConfig {
  readonly databaseURL: string;
}

export async function applyMigrations(config: ApplyMigrationsConfig): Promise<MigrationResultSet> {
  const db = buildMigrationDB({ databaseURL: config.databaseURL });

  try {
    return await buildMigrator(db).migrateToLatest();
  } finally {
    await db.destroy();
  }
}
