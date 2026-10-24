import { CamelCasePlugin, Kysely } from 'kysely';
import { buildMigrationDialect } from './build-migration-dialect';
import type { DB } from './schema.generated';

interface BuildMigrationDBConfig {
  readonly databaseURL: string;
}

export function buildMigrationDB(config: BuildMigrationDBConfig): Kysely<DB> {
  return new Kysely<DB>({
    dialect: buildMigrationDialect(config.databaseURL),
    plugins: [new CamelCasePlugin()],
  });
}
