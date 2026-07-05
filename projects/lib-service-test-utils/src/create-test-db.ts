import { createId } from '@paralleldrive/cuid2';
import * as schema from '@vers/postgres-schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

declare module 'vitest' {
  export interface ProvidedContext {
    dbURI: string;
    templateDB: string;
  }
}

/**
 * Creates a test database with a unique name from our template database.
 *
 * Implements a `Symbol.asyncDispose` method to clean up the client connection.
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

  console.log(`✔️ created test DB ${dbName}`);

  const connectionString = `${dbURI}/${dbName}`;

  const client = postgres(connectionString);

  return {
    db: drizzle(client, { schema }),
    [Symbol.asyncDispose]: () => client.end(),
  };
}
