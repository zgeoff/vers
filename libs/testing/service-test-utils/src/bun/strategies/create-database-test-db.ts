import { createDB } from '@vers/db';
import { removeTestDatabase } from '@vers/db/test-support';
import { createDatabaseFromTemplate } from '../create-database-from-template';
import type { TestDBHandle } from '../test-db-handle';

export async function createDatabaseTestDB(): Promise<TestDBHandle> {
  const databaseURL = await createDatabaseFromTemplate();

  const db = createDB({ databaseURL, resumeDetection: false });

  return {
    db,
    [Symbol.asyncDispose]: async () => {
      await db.destroy();

      await removeTestDatabase(databaseURL);
    },
  };
}
