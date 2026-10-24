import { buildCheckpointArchive } from './build-checkpoint-archive';
import { buildCheckpointArchiveKey } from './build-checkpoint-archive-key';
import type { ArchiveCandidate, CheckpointArchiveDeps } from './types';

type ArchiveOutcome =
  | { readonly archivedRows: number; readonly deletedRows: number; readonly kind: 'archived' }
  | { readonly kind: 'changed' };

export async function archiveActivityCheckpoints(
  deps: CheckpointArchiveDeps,
  candidate: Readonly<ArchiveCandidate>,
  now: Date,
): Promise<ArchiveOutcome> {
  // one statement reads the rows and the stamp together, so a sweep that overlaps another reads
  // either every row or none, and never overwrites a whole archive with the tail alone
  const rows = await deps.db
    .selectFrom('activityCheckpoints')
    .innerJoin('activities', 'activities.id', 'activityCheckpoints.activityId')
    .selectAll('activityCheckpoints')
    .where('activityCheckpoints.activityId', '=', candidate.activityID)
    .where('activities.archivedAt', 'is', null)
    .orderBy('activityCheckpoints.version')
    .execute();

  if (rows.length === 0) {
    return { kind: 'changed' };
  }

  const key = buildCheckpointArchiveKey(candidate.avatarID, candidate.activityID);
  const archive = buildCheckpointArchive(rows);

  await deps.bucket.write(key, archive, { type: 'application/gzip' });

  const readBack = await deps.bucket.file(key).bytes();

  if (!Buffer.from(readBack).equals(archive)) {
    throw new Error(
      `the archive of activity ${candidate.activityID} read back other bytes than were written; its rows stay in Postgres`,
    );
  }

  // the tail row stays: the latest-progress anchor and the next activity's seed both read it
  const stamped = await deps.db
    .with('stamped', (db) =>
      db
        .updateTable('activities')
        .set({ archivedAt: now })
        .where('id', '=', candidate.activityID)
        .where('archivedAt', 'is', null)
        .where('status', 'in', ['stopped', 'capped'])
        .where('appendedHead', '=', candidate.appendedHead)
        .where('verifiedHead', '=', candidate.appendedHead)
        .returning('id'),
    )
    .with('deleted', (db) =>
      db
        .deleteFrom('activityCheckpoints')
        .where('activityId', 'in', (eb) => eb.selectFrom('stamped').select('id'))
        .where('version', '<', candidate.appendedHead)
        .returning('version'),
    )
    .selectFrom('stamped')
    .select((eb) =>
      eb
        .selectFrom('deleted')
        .select((count) => count.fn.countAll<string>().as('rows'))
        .as('deletedRows'),
    )
    .executeTakeFirst();

  if (stamped === undefined) {
    return { kind: 'changed' };
  }

  return { archivedRows: rows.length, deletedRows: Number(stamped.deletedRows), kind: 'archived' };
}
