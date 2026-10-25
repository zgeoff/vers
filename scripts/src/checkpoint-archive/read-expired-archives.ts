import type { S3ListObjectsOptions } from 'bun';
import { canPurgeArchive } from './can-purge-archive';
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

    const purgeable = await readPurgeableArchives(deps, expired, writtenBefore);

    archives.push(...purgeable);

    listOptions =
      page.isTruncated === true && page.nextContinuationToken !== undefined
        ? { continuationToken: page.nextContinuationToken, prefix: 'checkpoints/' }
        : undefined;
  }

  return archives;
}

async function readPurgeableArchives(
  deps: CheckpointArchiveDeps,
  expired: ReadonlyArray<ExpiredArchive>,
  writtenBefore: Date,
): Promise<Array<ExpiredArchive>> {
  if (expired.length === 0) {
    return [];
  }

  const heads = await deps.db
    .selectFrom('activities')
    .select(['id', 'archivedAt'])
    .where(
      'id',
      'in',
      expired.map((archive) => archive.activityID),
    )
    .execute();

  const headsByID = new Map(heads.map((head) => [head.id, head]));

  return expired.filter((archive) =>
    canPurgeArchive(headsByID.get(archive.activityID), writtenBefore),
  );
}
