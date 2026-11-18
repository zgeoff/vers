import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { removeTestDatabase } from '@vers/db/test-support';
import type { Kysely } from 'kysely';
import { cloneDatabaseFromTemplate } from '../clone-database-from-template';
import { registerWorkerClone } from '../register-worker-clone';
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

let workerDB: Promise<WorkerDB> | undefined;

async function resolveWorkerDB(): Promise<Kysely<DB>> {
  workerDB ??= createWorkerDB();

  const worker = await workerDB;

  return worker.db;
}

interface WorkerDB {
  readonly databaseURL: string;
  readonly db: Kysely<DB>;
}

async function createWorkerDB(): Promise<WorkerDB> {
  const databaseURL = await cloneDatabaseFromTemplate();

  const db = createDB({ databaseURL, resumeDetection: false });

  registerWorkerClone(async () => {
    workerDB = undefined;

    await db.destroy();

    await removeTestDatabase(databaseURL);
  });

  return { databaseURL, db };
}
