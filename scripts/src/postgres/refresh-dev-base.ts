import { join } from 'node:path';
import { migrateToLatest } from '@vers/db';
import { execa } from 'execa';
import postgres from 'postgres';
import { buildDevDSN } from './build-dev-dsn';

/**
 * Rebuilds dev_base from nothing: forced drop, create, migrate, seed. The
 * seed step shells out to @vers/db's kysely-ctl script because seeds are a
 * kysely-ctl feature with no library entrypoint. Existing per-worktree clones
 * are untouched — they pick up new migrations on their next session.
 */
export async function refreshDevBase(maintenanceDSN: string, repoRoot: string): Promise<void> {
  const pg = postgres(maintenanceDSN, { max: 1 });

  try {
    await pg.unsafe('DROP DATABASE IF EXISTS dev_base WITH (FORCE)');
    await pg.unsafe('CREATE DATABASE dev_base');
  } finally {
    await pg.end();
  }

  const devBaseDSN = buildDevDSN(maintenanceDSN, 'dev_base');

  const result = await migrateToLatest({ databaseURL: devBaseDSN });

  if (result.error !== undefined) {
    throw result.error instanceof Error
      ? result.error
      : new Error('dev_base migration failed', { cause: result.error });
  }

  await execa('bun', ['run', 'db:seed'], {
    cwd: join(repoRoot, 'libs/data/db'),
    env: { DATABASE_URL: devBaseDSN },
    stdio: 'inherit',
  });
}
