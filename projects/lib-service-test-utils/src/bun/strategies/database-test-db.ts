import { createDB } from '@vers/db';
import { cloneTemplateDatabase } from '../clone-database';
import type { TestDB } from '../test-db-handle';

/**
 * Database isolation: a fresh template clone per acquire, for code that commits mid-op, takes
 * advisory locks, or asserts something that only fires at COMMIT — cases the rollback-on-dispose
 * transaction strategy can't observe.
 */
export async function createDatabaseTestDB(): Promise<TestDB> {
  const db = createDB({ databaseURL: await cloneTemplateDatabase() });

  return { db, [Symbol.asyncDispose]: () => db.destroy() };
}
