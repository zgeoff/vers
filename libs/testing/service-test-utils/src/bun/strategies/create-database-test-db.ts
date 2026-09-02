import { createDB } from '@vers/db';
import { createDatabaseFromTemplate } from '../create-database-from-template';
import type { TestDBHandle } from '../test-db-handle';

export async function createDatabaseTestDB(): Promise<TestDBHandle> {
  const db = createDB({ databaseURL: await createDatabaseFromTemplate() });

  return { db, [Symbol.asyncDispose]: () => db.destroy() };
}
