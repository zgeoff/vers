import { type Kysely, sql } from 'kysely';

/**
 * Ports the `users` table from the drizzle schema
 * (projects/lib-postgres-schema/src/users.ts) at its final shape — the sum of
 * drizzle migrations 0000 through 0011, including the `seed` column from #125.
 *
 * Note: drizzle's `$onUpdate` on `updated_at` is application-level, not DDL —
 * kysely equivalents are a trigger or setting the column in update queries.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('username', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('password_hash', 'text')
    .addColumn('password_reset_token', 'text')
    .addColumn('password_reset_token_expires_at', 'timestamp')
    .addColumn('seed', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('users').execute();
}
