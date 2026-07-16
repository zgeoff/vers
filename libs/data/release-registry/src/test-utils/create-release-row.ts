import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { ReleaseRow } from '../types';
import { createMockReleaseRow } from './factories/create-mock-release-row';

/**
 * Inserts a `releases` row via kysely — needed to seed rows with a specific app or `deployedAt`
 * that the functions under test aren't themselves responsible for producing. The generated `id`
 * is left to the database.
 */
export function createReleaseRow(
  db: Kysely<DB>,
  overrides: Readonly<Partial<ReleaseRow>> = {},
): Promise<ReleaseRow> {
  const { id: _id, ...values } = createMockReleaseRow(overrides);

  return db.insertInto('releases').values(values).returningAll().executeTakeFirstOrThrow();
}
