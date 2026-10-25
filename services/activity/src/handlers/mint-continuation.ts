import type { BuildSnapshot } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import { buildLevelFromXP } from '@vers/idle-core';
import type { Kysely } from 'kysely';
import { loadOptimisticBuild } from '../load-optimistic-build';
import { ContinuationBailError } from './continuation-bail-error';
import { mintActivityRoot } from './mint-activity-root';
import type { MintedContinuation, PinnedActivityContext, RunContinuationInput } from './types';

export async function mintContinuation(
  trx: Kysely<DB>,
  input: Readonly<RunContinuationInput>,
  pinned: Readonly<PinnedActivityContext>,
): Promise<MintedContinuation> {
  const quarantined = await trx
    .selectFrom('activities')
    .select('id')
    .where('avatarId', '=', pinned.avatarId)
    .where('scopeType', '=', pinned.scopeType)
    .where('scopeId', '=', pinned.scopeId)
    .where('status', '=', 'quarantined')
    .executeTakeFirst();

  if (quarantined !== undefined) {
    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: input.targetExpectedHead,
      kind: 'chain-quarantined',
    });
  }

  const chain = await trx
    .selectFrom('activityChains')
    .select(['appendedNextSeed', 'appendedChainIndex'])
    .where('avatarId', '=', pinned.avatarId)
    .where('scopeType', '=', pinned.scopeType)
    .where('scopeId', '=', pinned.scopeId)
    .executeTakeFirstOrThrow();

  const optimistic = await loadOptimisticBuild(trx, pinned.avatarId);

  const buildSnapshot: BuildSnapshot = {
    level: buildLevelFromXP(optimistic.totalXP),
    xp: optimistic.totalXP,
  };

  const continuation = input.continuation;

  if (
    buildSnapshot.level !== continuation.buildSnapshot.level ||
    buildSnapshot.xp !== continuation.buildSnapshot.xp
  ) {
    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: input.targetExpectedHead,
      avatarID: pinned.avatarId,
      kind: 'checkpoint-invalid',
      reason: 'build-snapshot-mismatch',
    });
  }

  const row = await mintActivityRoot(trx, {
    activityID: continuation.id,
    avatarID: pinned.avatarId,
    buildSnapshot,
    contentVersion: pinned.contentVersion,
    encounterNode: pinned.encounterNode,
    keyVersion: pinned.keyVersion,
    playedAt: null,
    predecessorActivityID: input.targetActivityID,
    scopeID: pinned.scopeId,
    scopeType: pinned.scopeType,
    secretRef: pinned.secretRef,
    secretVersion: pinned.secretVersion,
    seed: chain.appendedNextSeed,
    simVersion: pinned.simVersion,
    startChainIndex: chain.appendedChainIndex,
    startKey: continuation.startKey,
    writerSessionID: input.actingSessionID,
  });

  return { mintOutcome: 'minted', row };
}
