import postgres from 'postgres';
import { buildAdvisoryLockKey } from './build-advisory-lock-key';
import { requireSafeDBIdentifier } from './require-safe-db-identifier';

interface CreateClonedDatabaseConfig {
  readonly baseURI: string;
  readonly templateDB: string;
  readonly dbName: string;
}

/**
 * Clones `dbName` from `templateDB` via `CREATE DATABASE ... TEMPLATE`, safe
 * to call concurrently with other clones and with `createTestTemplate`: a
 * shared session advisory lock on the same key as `createTestTemplate`'s
 * exclusive lock lets clones run in parallel with each other while still
 * excluding a migrate in flight — postgres refuses to clone a template that
 * has an active connection.
 */
export async function createClonedDatabase(
  config: Readonly<CreateClonedDatabaseConfig>,
): Promise<void> {
  requireSafeDBIdentifier(config.templateDB);
  requireSafeDBIdentifier(config.dbName);

  const lockKey = buildAdvisoryLockKey(config.templateDB);
  const admin = postgres(`${config.baseURI}/postgres`);

  try {
    // a session advisory lock is scoped to the connection that took it, so the
    // lock and unlock below must run on the same reserved connection rather
    // than any connection the pool happens to hand back
    const session = await admin.reserve();

    try {
      await session`SELECT pg_advisory_lock_shared(${lockKey}::bigint)`;

      await session.unsafe(
        /* SQL */ `CREATE DATABASE ${config.dbName} TEMPLATE ${config.templateDB}`,
      );
    } finally {
      try {
        // a session advisory lock dies with its session, so a failed unlock
        // only matters when the session is still alive to hold it — safe to
        // swallow rather than risk masking the block above's error
        await session`SELECT pg_advisory_unlock_shared(${lockKey}::bigint)`;
      } catch {
        // see comment above
      }

      session.release();
    }
  } finally {
    await admin.end();
  }
}
