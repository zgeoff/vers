import { onTestFinished } from 'bun:test';
import { removeTestDatabase } from '@vers/db/test-support';
import { cloneDatabaseFromTemplate } from './clone-database-from-template';

// Call it inside a test. `onTestFinished` hooks run in the order they are registered, so the drop
// registers a hook from inside a hook: that one runs after every hook the test registers, such as a
// service stop, and no connection is open when the drop runs.
export async function createDatabaseFromTemplate(): Promise<string> {
  const databaseURL = await cloneDatabaseFromTemplate();

  onTestFinished(() => {
    onTestFinished(() => removeTestDatabase(databaseURL));
  });

  return databaseURL;
}
