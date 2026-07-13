import type { Activities, DB } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createAvatarRow } from './create-avatar-row';
import { createMockActivityRow } from './factories/create-mock-activity-row';

/**
 * Persists an activity head row sourced from the factory's defaults, creating an owning avatar
 * when `avatarId` is omitted — the head row's foreign key needs a real one.
 */
export async function createActivityRow(
  db: Kysely<DB>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Activities' jsonb `buildSnapshot` field types as the generated `Json` union, which nests a mutable `JsonValue[]` branch with no readonly form
  overrides: Partial<Insertable<Activities>> = {},
): Promise<Selectable<Activities>> {
  let avatarId = overrides.avatarId;

  if (avatarId === undefined) {
    const avatar = await createAvatarRow(db);

    avatarId = avatar.id;
  }

  return db
    .insertInto('activities')
    .values(createMockActivityRow({ ...overrides, avatarId }))
    .returningAll()
    .executeTakeFirstOrThrow();
}
