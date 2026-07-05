import { createId } from '@paralleldrive/cuid2';
import postgres from 'postgres';
import { createDB } from '../create-db';

/**
 * Creates a uniquely named database cloned from the migrated template
 * database and returns a `@vers/db` client bound to it.
 *
 * Implements `Symbol.asyncDispose` to close the client's connection.
 *
 * @returns - The test database client.
 */
export async function createTestDB() {
  const { inject } = await import('vitest');

  const dbURI = inject('dbURI');
  const templateDB = inject('templateDB');
  const setupClient = postgres(`${dbURI}/postgres`);

  const dbName = `test_${createId()}`;

  await setupClient.unsafe(/* SQL */ `CREATE DATABASE ${dbName} TEMPLATE ${templateDB}`);

  await setupClient.end();

  const db = createDB({ databaseURL: `${dbURI}/${dbName}` });

  return {
    db,
    [Symbol.asyncDispose]: () => db.destroy(),
  };
}
