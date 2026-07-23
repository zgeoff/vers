import type { Activities, DB } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockActivity } from '../factories/create-mock-activity';

interface CreateActivityRowData extends Partial<Insertable<Activities>> {
  readonly avatarId: string;
}

/**
 * Seeds an activity head row for an existing avatar, defaulting to a real `status = 'active'` row.
 */
export function createActivityRow(
  db: Kysely<DB>,
  data: Readonly<CreateActivityRowData>,
): Promise<Selectable<Activities>> {
  const row = createMockActivity(data);

  return db.insertInto('activities').values(row).returningAll().executeTakeFirstOrThrow();
}
