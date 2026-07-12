import { setTimeout as sleep } from 'node:timers/promises';
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

  const result = await migrateToLatest({
    databaseURL: buildDevDSN(config.maintenanceDSN, config.dbName),
  });

  if (result.error !== undefined) {
    throw result.error instanceof Error
      ? result.error
      : new Error('dev database migration failed', { cause: result.error });
  }
}

const CLONE_ATTEMPTS = 4;
const CLONE_RETRY_DELAY_MS = 1500;

/**
 * Neon's compute briefly opens its own sessions against databases while
 * waking from scale-to-zero, and a session on dev_base makes the clone fail
 * with 55006 (object_in_use) — retry through that window; anything else
 * throws immediately.
 */
async function createCloneOfDevBase(pg: postgres.Sql, dbName: string): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await pg.unsafe(`CREATE DATABASE ${dbName} TEMPLATE dev_base`);

      return;
    } catch (error) {
      const isTemplateBusy = error instanceof postgres.PostgresError && error.code === '55006';

      if (!isTemplateBusy || attempt >= CLONE_ATTEMPTS) {
        throw error;
      }

      await sleep(CLONE_RETRY_DELAY_MS);
    }
  }
}
