import type { CheckpointArchiveDeps, ExpiredArchive } from './types';

export async function removeExpiredArchives(
  deps: CheckpointArchiveDeps,
  archives: ReadonlyArray<ExpiredArchive>,
  writtenBefore: Date,
): Promise<number> {
  let removed = 0;

  for (const archive of archives) {
    // the listing can be stale by now: a restore and a later sweep may have written the object again
    const head = await deps.db
      .selectFrom('activities')
      .select('id')
      .where('id', '=', archive.activityID)
      .where('archivedAt', '<', writtenBefore)
      .executeTakeFirst();

    const object = await deps.bucket.stat(archive.key);

    if (head !== undefined && object.lastModified < writtenBefore) {
      await deps.bucket.delete(archive.key);

      removed += 1;
    }
  }

  return removed;
}
