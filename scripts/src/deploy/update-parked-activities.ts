import type { Activities, DB } from '@vers/db';
import { transitionActivityStatus } from '@vers/db';
import type { Kysely, Selectable } from 'kysely';

type UnparkedActivity = Pick<Selectable<Activities>, 'id'>;

export function updateParkedActivities(db: Kysely<DB>): Promise<Array<UnparkedActivity>> {
  if (db.isTransaction) {
    return restoreParkedActivities(db);
  }

  return db.transaction().execute(restoreParkedActivities);
}

const RESTORED_STATUSES = ['active', 'stopped', 'capped'] as const;

async function restoreParkedActivities(trx: Kysely<DB>): Promise<Array<UnparkedActivity>> {
  const unparked: Array<UnparkedActivity> = [];

  for (const status of RESTORED_STATUSES) {
    const restored = await transitionActivityStatus(
      trx,
      (eb) =>
        eb.and([
          status === 'active'
            ? eb.or([eb('parkedFrom', 'is', null), eb('parkedFrom', '=', 'active')])
            : eb('parkedFrom', '=', status),
          eb(
            'simVersion',
            'in',
            eb.selectFrom('simVersions').select('engineHash').where('status', '=', 'active'),
          ),
        ]),
      { from: ['parked'], to: status },
    )
      .returning('id')
      .execute();

    unparked.push(...restored);
  }

  return unparked;
}
