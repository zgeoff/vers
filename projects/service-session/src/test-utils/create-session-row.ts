import type { DB, Sessions } from '@vers/db';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { createMockSession } from './factories/create-mock-session';

interface CreateSessionRowData extends Partial<Insertable<Sessions>> {
  readonly userId: string;
}

/**
 * Inserts a session row for a given owner via kysely — needed to seed sessions owned by *another*
 * user for cross-tenant ownership tests, and to backdate `createdAt` for refresh-rotation tests,
 * neither of which can go through the owner-scoped RPC client.
 */
export function createSessionRow(
  db: Kysely<DB>,
  data: Readonly<CreateSessionRowData>,
): Promise<Selectable<Sessions>> {
  const row = createMockSession(data);

  return db.insertInto('sessions').values(row).returningAll().executeTakeFirstOrThrow();
}
