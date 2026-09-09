import { createId } from '@paralleldrive/cuid2';
import { createDB } from '../create-db';
import type { CreateDBConfig } from '../create-db';
import { createClonedDatabase } from './create-cloned-database';
import { resolveTestDBTarget } from './resolve-test-db-target';

interface CreateTestDBConfig extends Pick<CreateDBConfig, 'queryDeadlineMs' | 'resumeDetection'> {
  readonly baseURI?: string;
}

export async function createTestDB(config: CreateTestDBConfig = {}) {
  const target = resolveTestDBTarget();
  const dbName = `test_${createId()}`;

  await createClonedDatabase({ baseURI: target.baseURI, dbName, templateDB: target.templateDB });

  const { baseURI = target.baseURI, ...dbConfig } = config;
  const db = createDB({ ...dbConfig, databaseURL: `${baseURI}/${dbName}` });

  return {
    db,
    [Symbol.asyncDispose]: () => db.destroy(),
  };
}
