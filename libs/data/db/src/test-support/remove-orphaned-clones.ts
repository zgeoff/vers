import postgres from 'postgres';
import { z } from 'zod';
import { CLONED_DB_PREFIX } from './cloned-db-prefix';
import { removeTestDatabase } from './remove-test-database';

const DatabaseRowSchema = z.object({ datname: z.string() });

export async function removeOrphanedClones(baseURI: string): Promise<ReadonlyArray<string>> {
  const admin = postgres(`${baseURI}/postgres`, { max: 1 });
  let clones: ReadonlyArray<string>;

  try {
    const rows = await admin`
      SELECT datname FROM pg_database WHERE starts_with(datname, ${CLONED_DB_PREFIX})
    `;

    clones = z
      .array(DatabaseRowSchema)
      .parse(rows)
      .map((row) => row.datname);
  } finally {
    await admin.end();
  }

  const orphans = clones.filter((dbName) => !isOwnerAlive(dbName));

  for (const dbName of orphans) {
    await removeTestDatabase(`${baseURI}/${dbName}`);
  }

  return orphans;
}

function isOwnerAlive(dbName: string): boolean {
  const [pid] = dbName.slice(CLONED_DB_PREFIX.length).split('_', 1);

  try {
    process.kill(Number(pid), 0);

    return true;
  } catch (error) {
    // EPERM means the process exists under another user, so its clone may still be in use
    return error instanceof Error && 'code' in error && error.code === 'EPERM';
  }
}
