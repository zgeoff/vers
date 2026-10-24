import type { OfflineActivityStartSubmission } from '@vers/contract-activity';
import type { Activities, DB } from '@vers/db';
import type { Kysely, Selectable } from 'kysely';
import { isUniqueViolation } from '../is-unique-violation';
import { admitActivityStart } from './admit-activity-start';
import { buildBailError } from './build-bail-error';
import { recordBailout } from './record-bailout';
import type {
  AdvanceActivityDeps,
  AdvanceActivityOpts,
  BailOutcome,
  MintCollisionResolution,
} from './types';

export async function resolveActivityStartRow(
  deps: AdvanceActivityDeps,
  opts: AdvanceActivityOpts,
  actingUserID: string,
  actingSessionID: null | string,
): Promise<Selectable<Activities>> {
  const initial = await deps.db
    .selectFrom('activities')
    .innerJoin('avatars', 'avatars.id', 'activities.avatarId')
    .selectAll('activities')
    .where('activities.id', '=', opts.input.activityID)
    .where('avatars.userId', '=', actingUserID)
    .executeTakeFirst();

  if (initial !== undefined) {
    return initial;
  }

  const activityStart = opts.input.activityStart;

  if (activityStart === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const avatar = await deps.db
    .selectFrom('avatars')
    .select('id')
    .where('id', '=', activityStart.avatarID)
    .where('userId', '=', actingUserID)
    .executeTakeFirst();

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  // The owner-scoped `initial` read misses a row at this id owned by another user; a row present
  // here is exactly that, so it stays NOT_FOUND rather than reaching the mint and surfacing as the
  // unique-violation CONFLICT — which would tell a caller the foreign id exists.
  const foreign = await deps.db
    .selectFrom('activities')
    .select('id')
    .where('id', '=', opts.input.activityID)
    .executeTakeFirst();

  if (foreign !== undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  try {
    return await deps.db.transaction().execute((trx) =>
      admitActivityStart(
        {
          keyVersion: deps.keyVersion,
          keysServiceURL: deps.keysServiceURL,
          loadContentDocument: deps.loadContentDocument,
          privateKey: deps.privateKey,
          secretRef: deps.secretRef,
          secretVersion: deps.secretVersion,
        },
        trx,
        { actingUserID, activityID: opts.input.activityID, actingSessionID, activityStart },
        opts.errors,
      ),
    );
  } catch (error: unknown) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    // The mint's insert lost to another row already minted at this client id — resolved here,
    // outside any transaction, since the one that just rolled back cannot run another statement
    // once a constraint violation has poisoned it.
    const recovered = await resolveActivityStartAdmissionCollision(
      deps.db,
      activityStart,
      opts.input.activityID,
    );

    if (recovered.kind === 'refused') {
      const outcome: BailOutcome = {
        activityID: opts.input.activityID,
        appendedHead: 0,
        avatarID: activityStart.avatarID,
        kind: 'conflict',
        reason: recovered.reason,
      };

      recordBailout(outcome);
      throw buildBailError(opts.errors, outcome);
    }

    return recovered.row;
  }
}

async function resolveActivityStartAdmissionCollision(
  db: Kysely<DB>,
  activityStart: Readonly<OfflineActivityStartSubmission>,
  activityID: string,
): Promise<MintCollisionResolution<Selectable<Activities>>> {
  const existing = await db
    .selectFrom('activities')
    .selectAll()
    .where('id', '=', activityID)
    .executeTakeFirst();

  if (existing === undefined) {
    return { kind: 'refused', reason: 'active-run-exists' };
  }

  if (
    existing.avatarId !== activityStart.avatarID ||
    existing.startKey !== activityStart.startKey ||
    existing.scopeType !== activityStart.scopeType ||
    existing.scopeId !== activityStart.scopeID
  ) {
    return { kind: 'refused', reason: 'activity-id-taken' };
  }

  return { kind: 'converged', row: existing };
}
