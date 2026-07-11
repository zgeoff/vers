import type { DB, Verifications } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockVerification } from './factories/create-mock-verification';

/**
 * Inserts a verification row via kysely — needed to seed a verification an email update must
 * repoint, which can't go through the RPC surface since this service owns no verification-creation
 * procedure.
 */
export function createVerificationRow(
  db: Kysely<DB>,
  overrides: Partial<Insertable<Verifications>> = {},
): Promise<Selectable<Verifications>> {
  const row = createMockVerification(overrides);

  return db.insertInto('verifications').values(row).returningAll().executeTakeFirstOrThrow();
}
