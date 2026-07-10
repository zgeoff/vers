import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { createDatabaseFromTemplate } from '../create-database-from-template';
import type { TestDBHandle } from '../test-db-handle';

/**
 * Transaction isolation: rollback on dispose, near-zero per-test cost. Correct only for code that
 * runs through the returned `db` — a handler that opens its own connection bypasses the rollback.
 * After an expected constraint violation the transaction is aborted, so a test asserting a
 * CONFLICT/unique error must not issue further queries on the same handle; it asserts the error
 * and ends.
 */
export async function createTransactionTestDB(): Promise<TestDBHandle> {
  const db = await getWorkerDB();
  const trx = await db.startTransaction().execute();

  return {
    db: trx,
    [Symbol.asyncDispose]: async () => {
      await trx.rollback().execute();
    },
  };
}

let workerDB: Promise<Kysely<DB>> | undefined;

/**
 * One template clone per test process, memoized: every acquire shares the same underlying database.
 */
function getWorkerDB(): Promise<Kysely<DB>> {
  workerDB ??= buildWorkerDB();

  return workerDB;
}

async function buildWorkerDB(): Promise<Kysely<DB>> {
  const databaseURL = await createDatabaseFromTemplate();

  return createDB({ databaseURL });
}
