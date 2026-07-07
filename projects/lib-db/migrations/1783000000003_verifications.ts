import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Creates the `verification_type` enum and the `verifications` table, one
 * row per active OTP/TOTP challenge, unique per `(target, type)` pair.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createType('verification_type')
    .asEnum(['2fa', '2fa-setup', 'onboarding', 'change-email'])
    .execute();

  await db.schema
    .createTable('verifications')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('type', sql`verification_type`, (col) => col.notNull())
    .addColumn('target', 'text', (col) => col.notNull())
    .addColumn('secret', 'text', (col) => col.notNull())
    .addColumn('algorithm', 'text', (col) => col.notNull())
    .addColumn('digits', 'integer', (col) => col.notNull())
    .addColumn('period', 'integer', (col) => col.notNull())
    .addColumn('char_set', 'text', (col) => col.notNull())
    .addColumn('expires_at', 'timestamp')
    .addColumn('last_verified_code', 'text')
    .addColumn('last_verified_at', 'timestamp')
    .addUniqueConstraint('verifications_target_type_unique', ['target', 'type'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('verifications').execute();
  await db.schema.dropType('verification_type').execute();
}
