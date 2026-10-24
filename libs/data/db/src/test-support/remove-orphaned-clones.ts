import postgres from 'postgres';
import { z } from 'zod';
import { readCloneOwnerPrefix } from './read-clone-owner-prefix';
import { removeTestDatabase } from './remove-test-database';

const DatabaseRowSchema = z.object({ datname: z.string() });

export async function removeOrphanedClones(baseURI: string): Promise<ReadonlyArray<string>> {
  const ownerPrefix = readCloneOwnerPrefix();
  const admin = postgres(`${baseURI}/postgres`, { max: 1 });
  let clones: ReadonlyArray<string>;

  try {
    const rows = await admin`
      SELECT datname FROM pg_database WHERE starts_with(datname, ${ownerPrefix})
    `;

    clones = z
      .array(DatabaseRowSchema)
      .parse(rows)
      .map((row) => row.datname);
  } finally {
    await admin.end();
  }

  const orphans = clones.filter((dbName) => !isOwnerAlive(dbName.slice(ownerPrefix.length)));

  for (const dbName of orphans) {
    await removeTestDatabase(`${baseURI}/${dbName}`);
  }

  return orphans;
}

function isOwnerAlive(ownedName: string): boolean {
  const [pid] = ownedName.split('_', 1);

  try {
    process.kill(Number(pid), 0);

    return true;
  } catch (error) {
    // EPERM means the process exists under another user, so its clone may still be in use
    return error instanceof Error && 'code' in error && error.code === 'EPERM';
  }
}
