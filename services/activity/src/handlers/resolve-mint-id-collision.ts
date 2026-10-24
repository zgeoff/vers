import type { CatchUpContinuation } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { MintCollisionResolution, MintedContinuation, PinnedActivityContext } from './types';

export async function resolveMintIDCollision(
  db: Kysely<DB>,
  pinned: Readonly<PinnedActivityContext>,
  continuation: Readonly<CatchUpContinuation>,
): Promise<MintCollisionResolution<MintedContinuation>> {
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
    existing.scopeType !== pinned.scopeType ||
    existing.scopeId !== pinned.scopeId
  ) {
    return { kind: 'refused', reason: 'activity-id-taken' };
  }

  return { kind: 'converged', row: { mintOutcome: 'converged', row: existing } };
}
