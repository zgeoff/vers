import type { DB, Verifications } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockVerification } from './factories/create-mock-verification';

/**
 * Inserts a verification row via kysely — needed to seed expired rows and rows with a known TOTP
 * config that can't go through the RPC surface, which never exposes the raw secret or timers.
 */
export function createVerificationRow(
  db: Kysely<DB>,
  overrides: Partial<Insertable<Verifications>> = {},
): Promise<Selectable<Verifications>> {
  const row = createMockVerification(overrides);

  return db.insertInto('verifications').values(row).returningAll().executeTakeFirstOrThrow();
}
