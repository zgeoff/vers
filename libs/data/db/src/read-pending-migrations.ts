import { buildMigrator } from './build-migrator';
import { createDB } from './create-db';

interface ReadPendingMigrationsConfig {
  readonly databaseURL: string;
}

export async function readPendingMigrations(
  config: ReadPendingMigrationsConfig,
): Promise<ReadonlyArray<string>> {
  const db = createDB({ databaseURL: config.databaseURL });

  try {
    const migrations = await buildMigrator(db).getMigrations();

    return migrations
      .filter((migration) => migration.executedAt === undefined)
      .map((migration) => migration.name);
  } finally {
    await db.destroy();
  }
}
