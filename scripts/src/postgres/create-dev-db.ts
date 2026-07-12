import { migrateToLatest } from '@vers/db';
import postgres from 'postgres';
import invariant from 'tiny-invariant';
import { buildDevDSN } from './build-dev-dsn';

interface CreateDevDBConfig {
  branch: string;
  dbName: string;
  machine: string;
  maintenanceDSN: string;
}

/**
 * Clones dev_base into dbName when it doesn't exist yet, stamping provenance
 * (machine, branch, creation time) as a database comment, then migrates the
 * database forward so an existing clone catches up with migrations that
 * landed after dev_base was last refreshed. The maintenance connection must
 * point at a database other than dev_base: postgres refuses to clone a
 * template that has open connections.
 */
export async function createDevDB(config: Readonly<CreateDevDBConfig>): Promise<void> {
  invariant(/^[a-z0-9_]+$/.test(config.dbName), `invalid dev database name: ${config.dbName}`);

  const pg = postgres(config.maintenanceDSN, { max: 1 });

  try {
    const existing = await pg`SELECT 1 FROM pg_database WHERE datname = ${config.dbName}`;

    if (existing.length === 0) {
      await pg.unsafe(`CREATE DATABASE ${config.dbName} TEMPLATE dev_base`);

      const provenance = JSON.stringify({
        branch: config.branch,
        createdAt: new Date().toISOString(),
        machine: config.machine,
      });

      await pg.unsafe(
        `COMMENT ON DATABASE ${config.dbName} IS '${provenance.replaceAll("'", "''")}'`,
      );
    }
  } finally {
    await pg.end();
  }

  const result = await migrateToLatest({
    databaseURL: buildDevDSN(config.maintenanceDSN, config.dbName),
  });

  if (result.error !== undefined) {
    throw result.error instanceof Error
      ? result.error
      : new Error('dev database migration failed', { cause: result.error });
  }
}
