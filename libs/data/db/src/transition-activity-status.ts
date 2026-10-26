import type { Kysely, UpdateQueryBuilder, UpdateResult } from 'kysely';
import invariant from 'tiny-invariant';
import { isActivityStatusMove } from './is-activity-status-move';
import type { ActivityStatus, DB } from './schema.generated';
import type { ActivityRowFilter, ActivityStatusMove } from './types';

export function transitionActivityStatus<To extends ActivityStatus>(
  db: Kysely<DB>,
  target: ActivityRowFilter | string,
  move: ActivityStatusMove<To>,
): UpdateQueryBuilder<DB, 'activities', 'activities', UpdateResult> {
  invariant(move.from.length > 0, 'a status move names at least one source status');

  invariant(
    move.from.every((from) => isActivityStatusMove(from, move.to)),
    `the activity status table refuses a move to ${move.to} from ${move.from.join(', ')}`,
  );

  const query = db
    .updateTable('activities')
    .set((eb) => ({ parkedFrom: move.to === 'parked' ? eb.ref('status') : null, status: move.to }))
    .where('status', 'in', move.from);

  return typeof target === 'string' ? query.where('id', '=', target) : query.where(target);
}
