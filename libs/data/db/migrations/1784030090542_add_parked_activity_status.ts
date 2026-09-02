import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // an enum value added inside a transaction cannot be written until that transaction commits, so
  // this migration adds the value and writes nothing
  await sql`ALTER TYPE activity_status ADD VALUE 'parked'`.execute(db);
}

// postgres has no DROP VALUE for enums, and nothing above wrote the value, so there is nothing to
// reverse
export async function down(): Promise<void> {}
