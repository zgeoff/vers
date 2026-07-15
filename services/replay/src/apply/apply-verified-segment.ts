import type { DB } from '@vers/db';
import { levelForXP } from '@vers/idle-core';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type { GrantOnce } from '../types';
import { updateVerifiedChainAnchor } from './update-verified-chain-anchor';

interface ChainAdvance {
  readonly chainIndex: number;
  readonly nextSeed: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

interface ApplyVerifiedSegmentInput {
  readonly activityID: string;
  readonly avatarID: string;

  /**
   * Advances the chain row's verified anchor alongside the cursor, for a segment that ends an
   * adjudicated activity. Guarded forward-only — a stale advance moves nothing.
   */
  readonly chain?: ChainAdvance;
  readonly expectedVerifiedHead: number;
  readonly grants?: ReadonlyArray<GrantOnce>;
  readonly verifiedHead: number;

  /**
   * Signed delta added to the avatar's xp (`xp = xp + delta`, floored at zero) — never an absolute
   * value, so a concurrent grant is never overwritten.
   */
  readonly xpDelta?: number;
}

type ApplyVerifiedSegmentResult =
  | { readonly applied: false }
  | { readonly applied: true; readonly granted: ReadonlyArray<GrantOnce> };

/**
 * Applies one replayed segment's verified outcome exactly once. The cursor guard is the whole
 * mechanism: `verified_head` advances only if it still holds the expected value, and every other
 * write — the identity delta, the chain-anchor advance, the grant-once inserts — commits in the
 * same local transaction behind it, so a duplicate or crashed-and-retried apply either lands whole
 * or not at all (`applied: false`, nothing to roll back). One-shot grants insert with
 * `ON CONFLICT DO NOTHING`; `granted` reports which of them actually landed, so a first-clear
 * bonus attaches only on the apply that won the insert. A successful apply resets the poison-pill
 * attempt counter. Runs inside the caller's transaction when given one (composing with a held
 * chain claim), or opens its own otherwise.
 */
export function applyVerifiedSegment(
  db: Kysely<DB>,
  input: Readonly<ApplyVerifiedSegmentInput>,
): Promise<ApplyVerifiedSegmentResult> {
  if (db.isTransaction) {
    return applySegmentWrites(db, input);
  }

  return db.transaction().execute((trx) => applySegmentWrites(trx, input));
}

async function applySegmentWrites(
  trx: Kysely<DB>,
  input: Readonly<ApplyVerifiedSegmentInput>,
): Promise<ApplyVerifiedSegmentResult> {
  const advanced = await trx
    .updateTable('activities')
    .set({ replayAttempts: 0, verifiedAt: sql`now()`, verifiedHead: input.verifiedHead })
    .where('id', '=', input.activityID)
    .where('verifiedHead', '=', input.expectedVerifiedHead)
    .returning('verifiedHead')
    .executeTakeFirst();

  if (advanced === undefined) {
    return { applied: false };
  }

  if (input.xpDelta !== undefined && input.xpDelta !== 0) {
    const settled = await trx
      .updateTable('avatars')
      .set({ xp: sql`GREATEST(0, xp + ${input.xpDelta})` })
      .where('id', '=', input.avatarID)
      .returning('xp')
      .executeTakeFirstOrThrow();

    await trx
      .updateTable('avatars')
      .set({ level: levelForXP(settled.xp) })
      .where('id', '=', input.avatarID)
      .execute();
  }

  if (input.chain !== undefined) {
    await updateVerifiedChainAnchor(trx, {
      avatarID: input.avatarID,
      chainIndex: input.chain.chainIndex,
      nextSeed: input.chain.nextSeed,
      scopeID: input.chain.scopeID,
      scopeType: input.chain.scopeType,
    });
  }

  if (input.grants === undefined || input.grants.length === 0) {
    return { applied: true, granted: [] };
  }

  const granted = await trx
    .insertInto('avatarGrants')
    .values(
      input.grants.map((grant) => ({
        avatarId: input.avatarID,
        key: grant.key,
        kind: grant.kind,
      })),
    )
    .onConflict((oc) => oc.doNothing())
    .returning(['key', 'kind'])
    .execute();

  return { applied: true, granted };
}
