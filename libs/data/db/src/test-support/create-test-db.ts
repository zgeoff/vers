import { createId } from '@paralleldrive/cuid2';
import { createDB } from '../create-db';
import type { CreateDBConfig } from '../create-db';
import { createClonedDatabase } from './create-cloned-database';
import { resolveTestDBTarget } from './resolve-test-db-target';

export async function createTestDB(config: Pick<CreateDBConfig, 'resumeDetection'> = {}) {
  const target = resolveTestDBTarget();
  const dbName = `test_${createId()}`;

  await createClonedDatabase({ baseURI: target.baseURI, dbName, templateDB: target.templateDB });

  const db = createDB({ ...config, databaseURL: `${target.baseURI}/${dbName}` });

  return {
    db,
    [Symbol.asyncDispose]: () => db.destroy(),
  };
}
