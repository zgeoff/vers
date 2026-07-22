import type { ActivitySnapshotSources, DB } from '@vers/db';
import type { Kysely, Selectable } from 'kysely';

interface SnapshotSourceInput {
  /**
   * The activity whose build snapshot borrowed xp.
   */
  readonly activityID: string;

  /**
   * The unverified run it borrowed from.
   */
  readonly sourceActivityID: string;
}

/**
 * Persists one snapshot-provenance edge. Both columns are foreign keys into activities the caller
 * has already created, so there is nothing for a factory to default.
 */
export function createSnapshotSourceRow(
  db: Kysely<DB>,
  input: Readonly<SnapshotSourceInput>,
): Promise<Selectable<ActivitySnapshotSources>> {
  return db
    .insertInto('activitySnapshotSources')
    .values({ activityId: input.activityID, sourceActivityId: input.sourceActivityID })
    .returningAll()
    .executeTakeFirstOrThrow();
}
