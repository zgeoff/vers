import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { createDatabaseFromTemplate } from '../create-database-from-template';
import type { TestDBHandle } from '../test-db-handle';

export async function createTransactionTestDB(): Promise<TestDBHandle> {
  const db = await resolveWorkerDB();
  const trx = await db.startTransaction().execute();

  return {
    db: trx,
    [Symbol.asyncDispose]: async () => {
      await trx.rollback().execute();
    },
  };
}

let workerDB: Promise<Kysely<DB>> | undefined;

function resolveWorkerDB(): Promise<Kysely<DB>> {
  workerDB ??= createWorkerDB();

  return workerDB;
}

async function createWorkerDB(): Promise<Kysely<DB>> {
  const databaseURL = await createDatabaseFromTemplate();

  return createDB({ databaseURL, resumeDetection: false });
}
