import { join } from 'node:path';
import { applyMigrations } from '@vers/db';
import { execa } from 'execa';
import postgres from 'postgres';
import { buildDevDSN } from './build-dev-dsn';

export async function refreshDevBase(maintenanceDSN: string, repoRoot: string): Promise<void> {
  const pg = postgres(maintenanceDSN, { max: 1 });

  try {
    // FORCE drops the database even while other sessions still hold connections to it.
    await pg.unsafe('DROP DATABASE IF EXISTS dev_base WITH (FORCE)');
    await pg.unsafe('CREATE DATABASE dev_base');
  } finally {
    await pg.end();
  }

  const devBaseDSN = buildDevDSN(maintenanceDSN, 'dev_base');

  const result = await applyMigrations({ databaseURL: devBaseDSN });

  if (result.error !== undefined) {
    throw result.error instanceof Error
      ? result.error
      : new Error('dev_base migration failed', { cause: result.error });
  }

  // Shells out to @vers/db's kysely-ctl script because seeds are a kysely-ctl feature with no
  // library entrypoint.
  await execa('bun', ['run', 'db:seed'], {
    cwd: join(repoRoot, 'libs/data/db'),
    env: { DATABASE_URL: devBaseDSN },
    stdio: 'inherit',
  });

  const lock = postgres(maintenanceDSN, { max: 1 });

  try {
    // Cloning fails while any session exists on the source, and Neon parks invisible backends on
    // recently connected databases for minutes, so dev_base is locked against new connections and
    // its own are terminated below — leaving it clonable.
    await lock.unsafe('ALTER DATABASE dev_base WITH ALLOW_CONNECTIONS false');

    await lock`
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = 'dev_base' AND usename = current_user
    `;
  } finally {
    await lock.end();
  }
}
