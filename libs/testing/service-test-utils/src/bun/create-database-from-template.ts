import {
  buildClonedDBName,
  createClonedDatabase,
  readCloneOwnerPrefix,
} from '@vers/db/test-support';
import { resolveTestDBTarget } from './resolve-test-db-target';

export async function createDatabaseFromTemplate(): Promise<string> {
  const target = resolveTestDBTarget();
  const dbName = buildClonedDBName(readCloneOwnerPrefix());

  await createClonedDatabase({ baseURI: target.baseURI, dbName, templateDB: target.templateDB });

  return `${target.baseURI}/${dbName}`;
}
