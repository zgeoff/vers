import { createId } from '@paralleldrive/cuid2';
import { createDB } from '@vers/db';
import postgres from 'postgres';

const DEFAULT_TEST_DB_URI = 'postgres://test:test@localhost:32999';
const DEFAULT_TEST_TEMPLATE_DB = 'test_template';

/**
 * Creates a uniquely named database cloned from the migrated template
 * database and returns a `@vers/db` client bound to it. Reads
 * `TEST_DB_URI`/`TEST_TEMPLATE_DB` published by `setupBunTestDB`, falling
 * back to the test container's fixed defaults so a bare `bun test` against
 * an already-running container still resolves.
 *
 * Implements `Symbol.asyncDispose` to close the client's connection.
 *
 * @returns - The test database client.
 */
export async function createKyselyTestDB() {
  const dbURI = process.env['TEST_DB_URI'] ?? DEFAULT_TEST_DB_URI;
  const templateDB = process.env['TEST_TEMPLATE_DB'] ?? DEFAULT_TEST_TEMPLATE_DB;
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
