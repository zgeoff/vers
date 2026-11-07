import type { Kysely } from 'kysely';
import type { ActivityStatus, DB } from './schema.generated';

interface ActivityStatusRow {
  readonly parkedFrom: ActivityStatus | null;
  readonly status: ActivityStatus;
}

export async function readActivityStatus(
  db: Kysely<DB>,
  activityID: string,
): Promise<ActivityStatusRow | null> {
  const row = await db
    .selectFrom('activities')
    .select(['parkedFrom', 'status'])
    .where('id', '=', activityID)
    .executeTakeFirst();

  return row ?? null;
}
