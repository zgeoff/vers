import type { S3ListObjectsOptions } from 'bun';
import { collectExpiredArchives } from './collect-expired-archives';
import type { CheckpointArchiveDeps } from './types';

export async function readExpiredArchiveKeys(
  deps: CheckpointArchiveDeps,
  writtenBefore: Date,
): Promise<Array<string>> {
  const keys: Array<string> = [];
  let listOptions: S3ListObjectsOptions | undefined = { prefix: 'checkpoints/' };

  while (listOptions !== undefined) {
    const page = await deps.bucket.list(listOptions);

    const expired = collectExpiredArchives(page.contents ?? [], writtenBefore);

    keys.push(...(await readStampedArchiveKeys(deps, expired)));

    listOptions =
      page.isTruncated === true && page.nextContinuationToken !== undefined
        ? { continuationToken: page.nextContinuationToken, prefix: 'checkpoints/' }
        : undefined;
  }

  return keys;
}

async function readStampedArchiveKeys(
  deps: CheckpointArchiveDeps,
  expired: ReadonlyArray<{ readonly activityID: string; readonly key: string }>,
): Promise<Array<string>> {
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
    .where('archivedAt', 'is not', null)
    .execute();

  const stampedIDs = new Set(stamped.map((row) => row.id));

  return expired
    .filter((archive) => stampedIDs.has(archive.activityID))
    .map((archive) => archive.key);
}
