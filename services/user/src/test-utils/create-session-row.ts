import type { DB, Sessions } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockSession } from './factories/create-mock-session';

interface CreateSessionRowData extends Partial<Insertable<Sessions>> {
  readonly userId: string;
}

export function createSessionRow(
  db: Kysely<DB>,
  data: Readonly<CreateSessionRowData>,
): Promise<Selectable<Sessions>> {
  const row = createMockSession(data);

  return db.insertInto('sessions').values(row).returningAll().executeTakeFirstOrThrow();
}
