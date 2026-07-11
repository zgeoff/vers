import { createId } from '@paralleldrive/cuid2';
import postgres from 'postgres';
import { createDB } from '../create-db';
import { resolveTestDBTarget } from './resolve-test-db-target';

/**
 * Creates a uniquely named database cloned from the migrated template
 * database and returns a `@vers/db` client bound to it.
 *
 * Implements `Symbol.asyncDispose` to close the client's connection.
 *
 * @returns - The test database client.
 */
export async function createTestDB() {
  const target = resolveTestDBTarget();
  const setupClient = postgres(`${target.baseURI}/postgres`);
  const dbName = `test_${createId()}`;

  await setupClient.unsafe(/* SQL */ `CREATE DATABASE ${dbName} TEMPLATE ${target.templateDB}`);
  await setupClient.end();

  const db = createDB({ databaseURL: `${target.baseURI}/${dbName}` });

  return {
    db,
    [Symbol.asyncDispose]: () => db.destroy(),
  };
}
