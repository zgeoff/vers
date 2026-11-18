import {
  buildClonedDBName,
  createClonedDatabase,
  readCloneOwnerPrefix,
} from '@vers/db/test-support';
import { resolveTestDBTarget } from './resolve-test-db-target';

// the caller owns the clone and drops it: use `createDatabaseFromTemplate` in a test
export async function cloneDatabaseFromTemplate(): Promise<string> {
  const target = resolveTestDBTarget();
  const dbName = buildClonedDBName(readCloneOwnerPrefix());

  await createClonedDatabase({ baseURI: target.baseURI, dbName, templateDB: target.templateDB });

  return `${target.baseURI}/${dbName}`;
}
