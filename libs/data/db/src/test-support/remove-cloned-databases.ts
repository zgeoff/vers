import { clonedDatabaseURLs } from './cloned-database-urls';
import { removeTestDatabase } from './remove-test-database';

export async function removeClonedDatabases(): Promise<void> {
  for (const databaseURL of clonedDatabaseURLs) {
    await removeTestDatabase(databaseURL);
  }
}
