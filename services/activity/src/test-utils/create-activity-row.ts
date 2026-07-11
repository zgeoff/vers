import type { Activities, DB } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockActivity } from './factories/create-mock-activity';

interface CreateActivityRowData extends Partial<Insertable<Activities>> {
  readonly avatarId: string;
}

/**
 * Inserts an activity row for a given avatar via kysely — needed to seed activities the
 * owner-scoped RPC client can't produce directly (a foreign avatar's activity, a specific
 * status/cursor state to assert against).
 */
export function createActivityRow(
  db: Kysely<DB>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Activities' jsonb `buildSnapshot` field types as the generated `Json` union, which nests a mutable `JsonValue[]` branch with no readonly form
  data: Readonly<CreateActivityRowData>,
): Promise<Selectable<Activities>> {
  const row = createMockActivity(data);

  return db.insertInto('activities').values(row).returningAll().executeTakeFirstOrThrow();
}
