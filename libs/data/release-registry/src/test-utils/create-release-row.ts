import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { ReleaseRow } from '../types';
import { createMockReleaseRow } from './factories/create-mock-release-row';

export function createReleaseRow(
  db: Kysely<DB>,
  overrides: Readonly<Partial<ReleaseRow>> = {},
): Promise<ReleaseRow> {
  const { id: _id, ...values } = createMockReleaseRow(overrides);

  return db.insertInto('releases').values(values).returningAll().executeTakeFirstOrThrow();
}
