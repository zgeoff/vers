import postgres from 'postgres';
import { migrateToLatest } from '../migrate-to-latest';
import { buildAdvisoryLockKey } from './build-advisory-lock-key';
import { requireSafeDBIdentifier } from './require-safe-db-identifier';

interface CreateTestTemplateConfig {
  readonly baseURI: string;
  readonly templateDB: string;
}

/**
 * Ensures a worktree's test-template database exists and carries every
 * `@vers/db` migration, safe to call concurrently from multiple `bun test`
 * processes racing on first use: an exclusive session advisory lock keyed by
 * the template name serializes the create-and-migrate sequence against other
 * calls to this function, and `migrateToLatest` is idempotent, so a template
 * that's already current is a no-op. The same lock key, taken in shared mode
 * by `createClonedDatabase`, keeps a clone from ever racing a migrate — a
 * clone whose source has an active connection is rejected by postgres.
 */
export async function createTestTemplate(
  config: Readonly<CreateTestTemplateConfig>,
): Promise<void> {
  requireSafeDBIdentifier(config.templateDB);

  const lockKey = buildAdvisoryLockKey(config.templateDB);
  const admin = postgres(`${config.baseURI}/postgres`);

  try {
    // a session advisory lock is scoped to the connection that took it, so the
    // lock and unlock below must run on the same reserved connection rather
    // than any connection the pool happens to hand back
    const session = await admin.reserve();

    try {
      await session`SELECT pg_advisory_lock(${lockKey}::bigint)`;

      const existing =
        await session`SELECT 1 FROM pg_database WHERE datname = ${config.templateDB}`;

      if (existing.length === 0) {
        await session.unsafe(/* SQL */ `CREATE DATABASE ${config.templateDB}`);
      }

      const result = await migrateToLatest({
        databaseURL: `${config.baseURI}/${config.templateDB}`,
      });

      if (result.error !== undefined) {
        throw result.error instanceof Error
          ? result.error
          : new Error('kysely migration failed', { cause: result.error });
      }
    } finally {
      try {
        // a session advisory lock dies with its session, so a failed unlock
        // only matters when the session is still alive to hold it — safe to
        // swallow rather than risk masking the block above's error
        await session`SELECT pg_advisory_unlock(${lockKey}::bigint)`;
      } catch {
        // see comment above
      }

      session.release();
    }
  } finally {
    await admin.end();
  }
}
