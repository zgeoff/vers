import postgres from 'postgres';
import { buildAdvisoryLockKey } from './build-advisory-lock-key';
import { requireSafeDBIdentifier } from './require-safe-db-identifier';

interface CreateClonedDatabaseConfig {
  readonly baseURI: string;
  readonly templateDB: string;
  readonly dbName: string;
}

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
      // shared mode lets clones run in parallel while excluding a migrate in flight, which holds
      // the same key exclusively: postgres refuses to clone a template with an active connection
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
