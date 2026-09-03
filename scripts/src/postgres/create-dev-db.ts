import { applyMigrations } from '@vers/db';
import pRetry from 'p-retry';
import postgres from 'postgres';
import invariant from 'tiny-invariant';
import { buildDevDSN } from './build-dev-dsn';

interface CreateDevDBConfig {
  branch: string;
  dbName: string;
  machine: string;
  maintenanceDSN: string;
}

// the maintenance connection must point at a database other than dev_base: postgres refuses to
// clone a template that has open connections
export async function createDevDB(config: Readonly<CreateDevDBConfig>): Promise<void> {
  invariant(/^[a-z0-9_]+$/.test(config.dbName), `invalid dev database name: ${config.dbName}`);

  const pg = postgres(config.maintenanceDSN, { max: 1 });

  try {
    const existing = await pg`SELECT 1 FROM pg_database WHERE datname = ${config.dbName}`;

    if (existing.length === 0) {
      await createCloneOfDevBase(pg, config.dbName);

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

  const result = await applyMigrations({
    databaseURL: buildDevDSN(config.maintenanceDSN, config.dbName),
  });

  if (result.error !== undefined) {
    throw result.error instanceof Error
      ? result.error
      : new Error('dev database migration failed', { cause: result.error });
  }
}

const CLONE_RETRIES = 3;
const CLONE_RETRY_DELAY_MS = 1500;

// Neon's compute opens its own sessions while it wakes from scale-to-zero; one on dev_base fails
// the clone with 55006 (object_in_use), so that code retries through the window
async function createCloneOfDevBase(pg: postgres.Sql, dbName: string): Promise<void> {
  await pRetry(() => pg.unsafe(`CREATE DATABASE ${dbName} TEMPLATE dev_base`), {
    factor: 1,
    minTimeout: CLONE_RETRY_DELAY_MS,
    retries: CLONE_RETRIES,
    shouldRetry: (context) =>
      context.error instanceof postgres.PostgresError && context.error.code === '55006',
  });
}
