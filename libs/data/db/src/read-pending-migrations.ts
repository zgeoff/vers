import { buildMigrationDB } from './build-migration-db';
import { buildMigrator } from './build-migrator';

interface ReadPendingMigrationsConfig {
  readonly databaseURL: string;
}

export async function readPendingMigrations(
  config: ReadPendingMigrationsConfig,
): Promise<ReadonlyArray<string>> {
  const db = buildMigrationDB({ databaseURL: config.databaseURL });

  try {
    const migrations = await buildMigrator(db).getMigrations();

    return migrations
      .filter((migration) => migration.executedAt === undefined)
      .map((migration) => migration.name);
  } finally {
    await db.destroy();
  }
}
