import { createId } from '@paralleldrive/cuid2';
import { createClonedDatabase } from '@vers/db/test-support';
import { resolveTestDBTarget } from './resolve-test-db-target';

export async function createDatabaseFromTemplate(): Promise<string> {
  const target = resolveTestDBTarget();
  const dbName = `test_${createId()}`;

  await createClonedDatabase({ baseURI: target.baseURI, dbName, templateDB: target.templateDB });

  return `${target.baseURI}/${dbName}`;
}
