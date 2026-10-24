import type { BuildSnapshot } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import { buildLevelFromXP } from '@vers/idle-core';
import type { Kysely } from 'kysely';
import { loadOptimisticBuild } from '../load-optimistic-build';
import { ContinuationBailError } from './continuation-bail-error';
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

  const seed = chain.appendedNextSeed;

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

  const startHash = buildStartHash({
    contentVersion: pinned.contentVersion,
    encounterNode: pinned.encounterNode,
    keyVersion: pinned.keyVersion,
    seed,
    simVersion: pinned.simVersion,
  });

  const row = await trx
    .insertInto('activities')
    .values({
      avatarId: pinned.avatarId,
      buildSnapshot,
      contentVersion: pinned.contentVersion,
      encounterNode: pinned.encounterNode,
      id: continuation.id,
      keyVersion: pinned.keyVersion,
      lastHash: startHash,
      predecessorActivityId: input.targetActivityID,
      scopeId: pinned.scopeId,
      scopeType: pinned.scopeType,
      secretRef: pinned.secretRef,
      secretVersion: pinned.secretVersion,
      seed,
      simVersion: pinned.simVersion,
      startChainIndex: chain.appendedChainIndex,
      startHash,
      startKey: continuation.startKey,
      writerSessionId: input.actingSessionID,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { mintOutcome: 'minted', row };
}
