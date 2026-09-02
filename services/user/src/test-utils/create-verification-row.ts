import type { DB, Verifications } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockVerification } from './factories/create-mock-verification';

export function createVerificationRow(
  db: Kysely<DB>,
  overrides: Partial<Insertable<Verifications>> = {},
): Promise<Selectable<Verifications>> {
  const row = createMockVerification(overrides);

  return db.insertInto('verifications').values(row).returningAll().executeTakeFirstOrThrow();
}
