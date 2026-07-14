import { createHash } from 'node:crypto';
import postgres from 'postgres';
import { migrateToLatest } from '../migrate-to-latest';

interface ProvisionTestTemplateConfig {
  readonly baseURI: string;
  readonly templateDB: string;
}

/**
 * Ensures a worktree's test-template database exists and carries every
 * `@vers/db` migration, safe to call concurrently from multiple `bun test`
 * processes racing on first use: a session advisory lock keyed by the
 * template name serializes the create-and-migrate sequence, and
 * `migrateToLatest` is idempotent, so a template that's already current is a
 * no-op.
 */
export async function provisionTestTemplate(
  config: Readonly<ProvisionTestTemplateConfig>,
): Promise<void> {
  requireSafeTemplateDBName(config.templateDB);

  const admin = postgres(`${config.baseURI}/postgres`);
  const lockKey = buildAdvisoryLockKey(config.templateDB);

  // a session advisory lock is scoped to the connection that took it, so the
  // lock and unlock below must run on the same reserved connection rather
  // than any connection the pool happens to hand back
  const session = await admin.reserve();

  try {
    await session`SELECT pg_advisory_lock(${lockKey}::bigint)`;

    const existing = await session`SELECT 1 FROM pg_database WHERE datname = ${config.templateDB}`;

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
    await session`SELECT pg_advisory_unlock(${lockKey}::bigint)`;

    session.release();

    await admin.end();
  }
}

/**
 * Guards the `CREATE DATABASE` statement below, which can't parameterize an
 * identifier: `templateDB` may come straight from the `TEST_TEMPLATE_DB` env
 * override, so this rejects anything that isn't already a safe identifier
 * rather than trusting the caller.
 */
function requireSafeTemplateDBName(name: string): void {
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`invalid test-template database name: ${name}`);
  }
}

/**
 * Session advisory locks take a signed 64-bit key; the template name's
 * sha256 hash gives every distinct name its own lock without a central
 * registry. Returned as a decimal string and cast to `bigint` in SQL, since
 * the postgres client's parameter types don't accept a JS `bigint` directly.
 */
function buildAdvisoryLockKey(name: string): string {
  return createHash('sha256').update(name).digest().readBigInt64BE(0).toString();
}
