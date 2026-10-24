import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Kysely } from 'kysely';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import type { DB } from './schema.generated';

export const migrationsFolder = path.join(import.meta.dirname, '../migrations');

export function buildMigrator(db: Kysely<DB>): Migrator {
  return new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      migrationFolder: migrationsFolder,
      path,
    }),
  });
}
