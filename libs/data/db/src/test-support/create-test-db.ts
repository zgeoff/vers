import { createDB } from '../create-db';
import type { CreateDBConfig } from '../create-db';
import { buildClonedDBName } from './build-cloned-db-name';
import { createClonedDatabase } from './create-cloned-database';
import { removeTestDatabase } from './remove-test-database';
import { resolveTestDBTarget } from './resolve-test-db-target';

interface CreateTestDBConfig extends Pick<CreateDBConfig, 'queryDeadlineMs' | 'resumeDetection'> {
  readonly baseURI?: string;
}

export async function createTestDB(config: CreateTestDBConfig = {}) {
  const target = resolveTestDBTarget();
  const dbName = buildClonedDBName();

  await createClonedDatabase({ baseURI: target.baseURI, dbName, templateDB: target.templateDB });

  const { baseURI = target.baseURI, ...dbConfig } = config;
  const db = createDB({ ...dbConfig, databaseURL: `${baseURI}/${dbName}` });

  return {
    db,
    [Symbol.asyncDispose]: async () => {
      await db.destroy();

      await removeTestDatabase(`${target.baseURI}/${dbName}`);
    },
  };
}
