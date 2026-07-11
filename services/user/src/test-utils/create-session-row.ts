import type { DB, Sessions } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockSession } from './factories/create-mock-session';

interface CreateSessionRowData extends Partial<Insertable<Sessions>> {
  readonly userId: string;
}

/**
 * Inserts a session row via kysely — needed to seed sessions a password reset must delete, which
 * can't go through the RPC surface since this service has no session-creation procedure.
 */
export function createSessionRow(
  db: Kysely<DB>,
  data: Readonly<CreateSessionRowData>,
): Promise<Selectable<Sessions>> {
  const row = createMockSession(data);

  return db.insertInto('sessions').values(row).returningAll().executeTakeFirstOrThrow();
}
