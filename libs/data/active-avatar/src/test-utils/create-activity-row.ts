import type { Activities, DB } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockActivityRow } from './factories/create-mock-activity-row';

interface CreateActivityRowData extends Partial<Insertable<Activities>> {
  readonly avatarId: string;
}

/**
 * Seeds an activity head row for an existing avatar — the live-run query tests need a real
 * `status = 'active'` row.
 */
export function createActivityRow(
  db: Kysely<DB>,
  data: Readonly<CreateActivityRowData>,
): Promise<Selectable<Activities>> {
  const row = createMockActivityRow(data);

  return db.insertInto('activities').values(row).returningAll().executeTakeFirstOrThrow();
}
