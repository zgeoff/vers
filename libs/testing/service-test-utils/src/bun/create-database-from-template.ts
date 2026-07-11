import { createId } from '@paralleldrive/cuid2';
import postgres from 'postgres';
import { resolveTestDBTarget } from './resolve-test-db-target';

/**
 * Creates a new database cloned from the migrated template; returns its connection URL.
 */
export async function createDatabaseFromTemplate(): Promise<string> {
  const target = resolveTestDBTarget();
  const admin = postgres(`${target.baseURI}/postgres`);
  const dbName = `test_${createId()}`;

  try {
    await admin.unsafe(/* SQL */ `CREATE DATABASE ${dbName} TEMPLATE ${target.templateDB}`);
  } finally {
    await admin.end();
  }

  return `${target.baseURI}/${dbName}`;
}
