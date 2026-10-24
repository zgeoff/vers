import type { S3ListObjectsOptions } from 'bun';
import { collectExpiredArchives } from './collect-expired-archives';
import type { CheckpointArchiveDeps, ExpiredArchive } from './types';

export async function readExpiredArchives(
  deps: CheckpointArchiveDeps,
  writtenBefore: Date,
): Promise<Array<ExpiredArchive>> {
  const archives: Array<ExpiredArchive> = [];
  let listOptions: S3ListObjectsOptions | undefined = { prefix: 'checkpoints/' };

  while (listOptions !== undefined) {
    const page = await deps.bucket.list(listOptions);

    const expired = collectExpiredArchives(page.contents ?? [], writtenBefore);

    const stamped = await readStampedArchives(deps, expired, writtenBefore);

    archives.push(...stamped);

    listOptions =
      page.isTruncated === true && page.nextContinuationToken !== undefined
        ? { continuationToken: page.nextContinuationToken, prefix: 'checkpoints/' }
        : undefined;
  }

  return archives;
}

async function readStampedArchives(
  deps: CheckpointArchiveDeps,
  expired: ReadonlyArray<ExpiredArchive>,
  writtenBefore: Date,
): Promise<Array<ExpiredArchive>> {
  if (expired.length === 0) {
    return [];
  }

  const stamped = await deps.db
    .selectFrom('activities')
    .select('id')
    .where(
      'id',
      'in',
      expired.map((archive) => archive.activityID),
    )
    .where('archivedAt', '<', writtenBefore)
    .execute();

  const stampedIDs = new Set(stamped.map((row) => row.id));

  return expired.filter((archive) => stampedIDs.has(archive.activityID));
}
