import type { CheckpointPayload, ContentDocument, EncounterNode } from '@vers/contract-activity';
import { buildCheckpointHash, buildStartHash } from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import type { AvatarItems } from '@vers/db';
import type { ActivityCheckpoint } from '@vers/idle-core';
import {
  ActivityCheckpointType,
  buildLevelFromXP,
  buildSimulationInput,
  isTerminalCheckpointType,
} from '@vers/idle-core';
import { runSimulation } from '@vers/idle-core/replay';
import { buildPositionStream, rollItemFromStream } from '@vers/item-gen';
import { deriveWorldmapContent } from '@vers/worldmap-content';
import { ORIGIN_CELL, getDifficulty, toNodeID } from '@vers/worldmap-core';
import type { Insertable } from 'kysely';
import invariant from 'tiny-invariant';
import type { PlannedCheckpointRow, PlannedRun, QARunsPlan } from './types';

export interface PlanQARunsInput {
  readonly activityIDs: ReadonlyArray<string>;
  readonly avatarID: string;
  readonly document: ContentDocument;
  readonly genesisSeed: string;
  readonly keyVersion: number;
  readonly now: Date;
  readonly rollKey: Uint8Array;
  readonly scopeSecret: Uint8Array;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
  readonly simVersion: string;
  readonly startXP: number;
  readonly userSeed: number;
}

const SCOPE_TYPE = 'world_map_node';
const ENTROPY_SOURCE = 'server-key';
const RUN_DURATION_MS = 600_000;
const RUN_SPACING_MS = 10 * 60 * 1000;

export async function planQARuns(input: Readonly<PlanQARunsInput>): Promise<QARunsPlan> {
  const scopeID = toNodeID(ORIGIN_CELL[0], ORIGIN_CELL[1]);

  const encounterNode: EncounterNode = {
    difficulty: getDifficulty(ORIGIN_CELL[0], ORIGIN_CELL[1]),
    ...deriveWorldmapContent(input.document.encounter, {
      coord: ORIGIN_CELL,
      scopeSecret: input.scopeSecret,
      userSeed: input.userSeed,
    }),
  };

  const runs: Array<PlannedRun> = [];

  const clearedNodeIDs = new Set<string>();

  let position = { chainIndex: 0, seed: input.genesisSeed };
  let xp = input.startXP;
  let predecessorActivityId: null | string = null;

  for (const [index, activityID] of input.activityIDs.entries()) {
    const startedAt = new Date(
      input.now.getTime() - (input.activityIDs.length - index) * RUN_SPACING_MS,
    );

    const run = await planRun(input, {
      activityID,
      encounterNode,
      position,
      predecessorActivityId,
      scopeID,
      startedAt,
      xp,
    });

    runs.push(run.planned);

    if (run.planned.outcome === 'completed') {
      clearedNodeIDs.add(scopeID);
    }

    position = run.tail;
    xp = Math.max(0, xp + run.planned.xpDelta);
    predecessorActivityId = activityID;
  }

  return {
    chain: {
      appendedChainIndex: position.chainIndex,
      appendedNextSeed: position.seed,
      avatarId: input.avatarID,
      genesisSeed: input.genesisSeed,
      scopeId: scopeID,
      scopeType: SCOPE_TYPE,
      verifiedChainIndex: position.chainIndex,
      verifiedNextSeed: position.seed,
    },
    clearedNodeIDs: [...clearedNodeIDs],
    finalXP: xp,
    runs,
  };
}

interface ChainPosition {
  readonly chainIndex: number;
  readonly seed: string;
}

interface PlanRunContext {
  readonly activityID: string;
  readonly encounterNode: EncounterNode;
  readonly position: ChainPosition;
  readonly predecessorActivityId: null | string;
  readonly scopeID: string;
  readonly startedAt: Date;
  readonly xp: number;
}

async function planRun(
  input: Readonly<PlanQARunsInput>,
  context: Readonly<PlanRunContext>,
): Promise<{ planned: PlannedRun; tail: ChainPosition }> {
  const contentVersion = input.document.contentVersion;
  const buildSnapshot = { level: buildLevelFromXP(context.xp), xp: context.xp };
  const seed = context.position.seed;
  const startChainIndex = context.position.chainIndex;

  const startHash = buildStartHash({
    contentVersion,
    encounterNode: context.encounterNode,
    keyVersion: input.keyVersion,
    seed,
    simVersion: input.simVersion,
  });

  const simulationInput = buildSimulationInput(input.document.encounter, {
    avatarID: input.avatarID,
    buildSnapshot,
    contentVersion,
    encounterNode: context.encounterNode,
    id: context.activityID,
    seed,
  });

  const simulated = await runSimulation(simulationInput.activity, simulationInput.avatar, {
    duration: RUN_DURATION_MS,
  });

  const terminalIndex = simulated.checkpoints.findIndex((checkpoint) =>
    isTerminalCheckpointType(checkpoint.type),
  );

  if (terminalIndex === -1) {
    throw new Error(
      `run ${context.activityID} reached no terminal checkpoint within ${RUN_DURATION_MS}ms of simulated time`,
    );
  }

  const engineCheckpoints = simulated.checkpoints.slice(0, terminalIndex + 1);
  const terminal = engineCheckpoints.at(-1);

  invariant(terminal !== undefined, 'a terminal prefix always ends on its terminal checkpoint');

  const checkpoints = buildCheckpointRows(engineCheckpoints, { seed, startChainIndex, startHash });
  const last = checkpoints.at(-1);

  invariant(last !== undefined, 'a run always stores its started checkpoint');

  const stoppedAt = new Date(context.startedAt.getTime() + Math.floor(terminal.time));

  const planned: PlannedRun = {
    activity: {
      appendedAt: stoppedAt,
      appendedHead: checkpoints.length,
      appendedTimeMs: Math.floor(terminal.time),
      avatarId: input.avatarID,
      buildSnapshot,
      contentVersion,
      encounterNode: context.encounterNode,
      id: context.activityID,
      keyVersion: input.keyVersion,
      lastHash: last.hash,
      playedAt: context.startedAt,
      predecessorActivityId: context.predecessorActivityId,
      replayAttempts: 0,
      scopeId: context.scopeID,
      scopeType: SCOPE_TYPE,
      secretRef: input.secretRef,
      secretVersion: input.secretVersion,
      seed,
      settledXp: terminal.rewards.xp,
      simVersion: input.simVersion,
      startChainIndex,
      startedAt: context.startedAt,
      startHash,
      startKey: null,
      status: 'stopped',
      stoppedAt,
      verifiedAt: stoppedAt,
      verifiedHead: checkpoints.length,
      writerSessionId: null,
    },
    checkpoints,
    items: rollItems(input, context, engineCheckpoints),
    outcome: terminal.type === ActivityCheckpointType.Completed ? 'completed' : 'failed',
    xpDelta: terminal.rewards.xp,
  };

  return { planned, tail: { chainIndex: last.payload.chainIndex, seed: terminal.nextSeed } };
}

interface CheckpointRowContext {
  readonly seed: string;
  readonly startChainIndex: number;
  readonly startHash: string;
}

function buildCheckpointRows(
  engineCheckpoints: ReadonlyArray<ActivityCheckpoint>,
  context: Readonly<CheckpointRowContext>,
): Array<PlannedCheckpointRow> {
  let prevHash = context.startHash;
  let runningSeed = context.seed;

  return engineCheckpoints.map((checkpoint, index) => {
    const version = index + 1;
    const chainIndex = context.startChainIndex + version;
    const seed = 'seed' in checkpoint ? checkpoint.seed : runningSeed;

    const hash = buildCheckpointHash({
      chainIndex,
      entropySource: ENTROPY_SOURCE,
      nextSeed: checkpoint.nextSeed,
      prevHash,
      seed,
      time: checkpoint.time,
      type: checkpoint.type,
      version,
    });

    const payload: CheckpointPayload = {
      chainIndex,
      entropySource: ENTROPY_SOURCE,
      nextSeed: checkpoint.nextSeed,
      rewards: checkpoint.rewards,
      rewardSlots: checkpoint.rewardSlots,
      seed,
      time: checkpoint.time,
      type: checkpoint.type,
      ...(checkpoint.levelUp !== undefined && { levelUp: checkpoint.levelUp }),
    };

    const row: PlannedCheckpointRow = { hash, payload, prevHash, version };

    prevHash = hash;
    runningSeed = checkpoint.nextSeed;

    return row;
  });
}

function rollItems(
  input: Readonly<PlanQARunsInput>,
  context: Readonly<PlanRunContext>,
  engineCheckpoints: ReadonlyArray<ActivityCheckpoint>,
): Array<Insertable<AvatarItems>> {
  return engineCheckpoints.flatMap((checkpoint, index) => {
    const chainIndex = context.position.chainIndex + index + 1;

    return checkpoint.rewardSlots.map((slot) => {
      const stream = buildPositionStream(input.rollKey, {
        avatarID: input.avatarID,
        chainIndex,
        kind: 'reward',
        ordinal: slot.ordinal,
        scopeID: context.scopeID,
        scopeType: SCOPE_TYPE,
      });

      const item = rollItemFromStream(
        input.document.loot,
        { nodeTier: slot.context.nodeTier },
        stream,
      );

      return {
        affixes: item.affixes.map((affix) => ({
          affixID: affix.affixID,
          groupID: affix.groupID,
          value: affix.value,
        })),
        avatarId: input.avatarID,
        baseId: item.baseID,
        chainIndex,
        contentVersion: item.contentVersion,
        keyVersion: input.keyVersion,
        ordinal: slot.ordinal,
        rarityId: item.rarityID,
        scopeId: context.scopeID,
        scopeType: SCOPE_TYPE,
      };
    });
  });
}
