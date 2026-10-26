import type { BuildSnapshot, CheckpointBatchEntry } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import type { EncounterContent } from '@vers/game-utils';
import { ENTROPY_SOURCE_SERVER_KEY, buildCheckpointBatchEntry } from '@vers/idle-client/headless';
import {
  buildLevelFromXP,
  buildSimulationInput,
  foldOptimisticBuild,
  runAttempt,
} from '@vers/idle-core';
import invariant from 'tiny-invariant';
import type { ActivityRun, PlayerChain } from './types';

interface RunActivityAttemptInput {
  readonly activityID: string;
  readonly avatarID: string;
  readonly buildSnapshot: BuildSnapshot;
  readonly chain: PlayerChain;
  readonly content: EncounterContent;
  readonly playedAt: Date;
  readonly predecessorActivityID: null | string;
  readonly simVersion: string;
}

// one attempt per activity, as the writer worker runs it: a terminal checkpoint ends the activity
// and the next attempt is a continuation minted at the anchor this one leaves
const ATTEMPT_DURATION_CAP_MS = 24 * 60 * 60 * 1000;

export async function runActivityAttempt(
  input: Readonly<RunActivityAttemptInput>,
): Promise<ActivityRun> {
  const chain = input.chain;

  const startHash = buildStartHash({
    contentVersion: chain.contentVersion,
    encounterNode: chain.encounterNode,
    keyVersion: chain.keyVersion,
    seed: chain.anchor.nextSeed,
    simVersion: input.simVersion,
  });

  const simulationInput = buildSimulationInput(input.content, {
    avatarID: input.avatarID,
    buildSnapshot: input.buildSnapshot,
    contentVersion: chain.contentVersion,
    encounterNode: chain.encounterNode,
    id: input.activityID,
    seed: chain.anchor.nextSeed,
  });

  const attempt = await runAttempt(simulationInput.activity, simulationInput.avatar, {
    maxDurationMs: ATTEMPT_DURATION_CAP_MS,
  });

  invariant(attempt.outcome !== 'exceeded-budget', 'an attempt ends inside the duration cap');

  const entries: Array<CheckpointBatchEntry> = [];
  let prevHash = startHash;
  let previousNextSeed = chain.anchor.nextSeed;

  for (const [index, checkpoint] of attempt.checkpoints.entries()) {
    const entry = buildCheckpointBatchEntry({
      checkpoint,
      entropySource: ENTROPY_SOURCE_SERVER_KEY,
      prevHash,
      previousNextSeed,
      startChainIndex: chain.anchor.chainIndex,
      version: index + 1,
    });

    entries.push(entry);

    prevHash = entry.hash;
    previousNextSeed = entry.payload.nextSeed;
  }

  const lastEntry = entries.at(-1);

  invariant(lastEntry !== undefined, 'a terminal attempt carries at least one checkpoint');

  const optimistic = foldOptimisticBuild(input.buildSnapshot.xp, [
    { settledXP: 0, tailPayload: lastEntry.payload, unverifiedDeltaSum: 0 },
  ]);

  return {
    entries,
    id: input.activityID,
    nextAnchor: {
      chainIndex: chain.anchor.chainIndex + lastEntry.version,
      nextSeed: lastEntry.payload.nextSeed,
    },
    nextBuildSnapshot: { level: buildLevelFromXP(optimistic.totalXP), xp: optimistic.totalXP },
    outcome: attempt.outcome,
    start: {
      avatarID: input.avatarID,
      buildSnapshot: input.buildSnapshot,
      contentVersion: chain.contentVersion,
      playedAt: input.playedAt,
      predecessorActivityID: input.predecessorActivityID,
      scopeID: chain.scopeID,
      scopeType: chain.scopeType,
      seed: chain.anchor.nextSeed,
      simVersion: input.simVersion,
      startChainIndex: chain.anchor.chainIndex,
      startHash,
      startKey: `load_${input.activityID}`,
    },
    xpTotal: optimistic.totalXP - input.buildSnapshot.xp,
  };
}
