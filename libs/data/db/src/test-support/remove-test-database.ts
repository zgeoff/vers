import postgres from 'postgres';
import { requireSafeDBIdentifier } from './require-safe-db-identifier';

export async function removeTestDatabase(databaseURL: string): Promise<void> {
  const url = new URL(databaseURL);

  const dbName = url.pathname.slice(1);

  requireSafeDBIdentifier(dbName);

  url.pathname = '/postgres';

  const admin = postgres(url.href, { max: 1 });

  try {
    // WITH (FORCE) ends the sessions a test left open on the database, such as a shared pool that
    // outlives every test of the run, so the drop never fails on a connection
    await admin.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  } finally {
    await admin.end();
  }
}
