import type { CatchUpContinuation } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { MintCollisionResolution, MintedContinuation, PinnedActivityContext } from './types';

interface MintIDCollision {
  readonly continuation: Readonly<CatchUpContinuation>;
  readonly pinned: Readonly<PinnedActivityContext>;
  readonly targetActivityID: string;
}

export async function resolveMintIDCollision(
  db: Kysely<DB>,
  collision: Readonly<MintIDCollision>,
): Promise<MintCollisionResolution<MintedContinuation>> {
  const continuation = collision.continuation;
  const pinned = collision.pinned;

  const existing = await db
    .selectFrom('activities')
    .selectAll()
    .where('id', '=', continuation.id)
    .executeTakeFirst();

  if (existing === undefined) {
    return { kind: 'refused', reason: 'active-run-exists' };
  }

  if (
    existing.avatarId !== pinned.avatarId ||
    existing.startKey !== continuation.startKey ||
    existing.predecessorActivityId !== collision.targetActivityID ||
    existing.scopeType !== pinned.scopeType ||
    existing.scopeId !== pinned.scopeId
  ) {
    return { kind: 'refused', reason: 'activity-id-taken' };
  }

  return { kind: 'converged', row: { mintOutcome: 'converged', row: existing } };
}
