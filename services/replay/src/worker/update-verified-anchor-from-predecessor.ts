import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { updateVerifiedChainAnchor } from '../apply/update-verified-chain-anchor';
import { findVerifiedAnchorPredecessor } from '../queue/find-verified-anchor-predecessor';
import type { ReplaySegment } from '../replay/types';

/**
 * Self-heals a chain's verified anchor when the claimed target's own `startChainIndex` sits
 * ahead of it: per-chain FIFO guarantees the gap is a fully verified, forward-exited predecessor
 * whose anchor advance was missed — the timing hole where a stream fully verifies while its
 * activity is still `active`, then forward-exits with nothing left to revisit it. No-ops, leaving
 * the chain row untouched, when the target isn't ahead or no such predecessor is found; the
 * caller's own divergence handling covers a real inconsistency.
 */
export async function updateVerifiedAnchorFromPredecessor(
  trx: Kysely<DB>,
  segment: Readonly<ReplaySegment>,
): Promise<{ chainIndex: number; nextSeed: string } | undefined> {
  if (segment.activity.startChainIndex <= segment.chain.verifiedChainIndex) {
    return undefined;
  }

  const predecessor = await findVerifiedAnchorPredecessor(trx, {
    avatarID: segment.activity.avatarID,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
    verifiedChainIndex: segment.chain.verifiedChainIndex,
  });

  if (predecessor === undefined) {
    return undefined;
  }

  await updateVerifiedChainAnchor(trx, {
    avatarID: segment.activity.avatarID,
    chainIndex: predecessor.chainIndex,
    nextSeed: predecessor.nextSeed,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
  });

  return predecessor;
}
