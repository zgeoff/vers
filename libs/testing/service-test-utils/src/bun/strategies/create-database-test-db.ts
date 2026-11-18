import { createDB } from '@vers/db';
import { removeTestDatabase } from '@vers/db/test-support';
import { cloneDatabaseFromTemplate } from '../clone-database-from-template';
import type { TestDBHandle } from '../test-db-handle';

export async function createDatabaseTestDB(): Promise<TestDBHandle> {
  const databaseURL = await cloneDatabaseFromTemplate();

  const db = createDB({ databaseURL, resumeDetection: false });

  return {
    db,
    [Symbol.asyncDispose]: async () => {
      await db.destroy();

      await removeTestDatabase(databaseURL);
    },
  };
}
