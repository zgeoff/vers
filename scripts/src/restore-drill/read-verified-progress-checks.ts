import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { RestoreDrillCheck } from './types';

export async function readVerifiedProgressChecks(
  db: Kysely<DB>,
): Promise<ReadonlyArray<RestoreDrillCheck>> {
  const [activitiesVerifiedPastAppended, activitiesOffStream, settledWithoutProof] =
    await Promise.all([
      db
        .selectFrom('activities')
        .select('id')
        .whereRef('verifiedHead', '>', 'appendedHead')
        .orderBy('id')
        .execute(),
      db
        .selectFrom('activities')
        .leftJoin('activityCheckpoints as checkpoint', 'checkpoint.activityId', 'activities.id')
        .select('activities.id')
        .groupBy(['activities.id', 'activities.appendedHead'])
        .having(
          (eb) => eb.fn.coalesce(eb.fn.max('checkpoint.version'), eb.lit(0)),
          '!=',
          (eb) => eb.ref('activities.appendedHead'),
        )
        .orderBy('activities.id')
        .execute(),
      db
        .selectFrom('activities')
        .select('id')
        .where('settledXp', '!=', 0)
        .where('verifiedHead', '=', 0)
        .orderBy('id')
        .execute(),
    ]);

  return [
    {
      area: 'verified-progress',
      name: 'the verified head sits at or behind the appended head',
      violations: activitiesVerifiedPastAppended.map((row) => `activity ${row.id}`),
    },
    {
      area: 'verified-progress',
      name: 'the appended head matches the stream’s last checkpoint',
      violations: activitiesOffStream.map((row) => `activity ${row.id}`),
    },
    {
      area: 'verified-progress',
      name: 'settled XP comes only from verified checkpoints',
      violations: settledWithoutProof.map((row) => `activity ${row.id}`),
    },
  ];
}
