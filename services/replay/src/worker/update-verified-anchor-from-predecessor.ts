import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { updateVerifiedChainAnchor } from '../apply/update-verified-chain-anchor';
import { findVerifiedAnchorPredecessor } from '../queue/find-verified-anchor-predecessor';
import type { ReplaySegment } from '../replay/types';

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
