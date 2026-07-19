import { createId } from '@paralleldrive/cuid2';
import { createDB } from '../create-db';
import { createClonedDatabase } from './create-cloned-database';
import { resolveTestDBTarget } from './resolve-test-db-target';

/**
 * Creates a uniquely named database cloned from the migrated template
 * database and returns a `@vers/db` client bound to it.
 *
 * Implements `Symbol.asyncDispose` to close the client's connection.
 */
export async function createTestDB() {
  const target = resolveTestDBTarget();
  const dbName = `test_${createId()}`;

  await createClonedDatabase({ baseURI: target.baseURI, dbName, templateDB: target.templateDB });

  const db = createDB({ databaseURL: `${target.baseURI}/${dbName}` });

  return {
    db,
    [Symbol.asyncDispose]: () => db.destroy(),
  };
}
