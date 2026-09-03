import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import { createContentVersion, findContentDocument } from '@vers/content-registry';
import type { CheckpointPayload, ContentDocument, EncounterNode } from '@vers/contract-activity';
import { buildCheckpointHash, buildStartHash } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import type { SecretRef } from '@vers/contract-keys';
import type { Activities, ActivityChains, DB } from '@vers/db';
import { toJSON } from '@vers/db';
import { buildStateFromSeed } from '@vers/game-utils';
import type { EncounterContent } from '@vers/game-utils';
import type { ActivityCheckpoint } from '@vers/idle-core';
import { buildLevelFromXP, buildSimulationInput } from '@vers/idle-core';
import { runSimulation } from '@vers/idle-core/replay';
import { buildMockScopeSecret } from '@vers/mock-services/keys';
import { deriveWorldmapContent } from '@vers/worldmap-content';
import {
  ORIGIN_CELL,
  collectNodeEdges,
  findCellCoord,
  getDifficulty,
  toNodeID,
} from '@vers/worldmap-core';
import type { Insertable, Kysely, Selectable } from 'kysely';
import invariant from 'tiny-invariant';
import { TERMINAL_CHECKPOINT_TYPES } from '../replay/types';
import { createActivityRow } from './create-activity-row';
import { createChainRow } from './create-chain-row';

const DEFAULT_SCOPE_ID = '1_0';
const DEFAULT_CONTENT_VERSION = '2';

interface HonestCheckpointRow {
  readonly hash: string;
  readonly payload: CheckpointPayload;
  readonly prevHash: string;
  readonly version: number;
}

interface HonestCheckpointContext {
  readonly seed: string;
  readonly startChainIndex: number;
  readonly startHash: string;
}

interface HonestActivityFixture {
  readonly activity: Selectable<Activities>;
  readonly chain: Selectable<ActivityChains>;
  readonly checkpoints: ReadonlyArray<HonestCheckpointRow>;

  readonly encounterNode: EncounterNode;

  readonly engineCheckpoints: ReadonlyArray<ActivityCheckpoint>;
}

interface CreateHonestActivityFixtureInput {
  readonly activity?: Readonly<Partial<Insertable<Activities>>>;
  readonly avatarID?: string;
  readonly buildSnapshot?: { readonly level: number; readonly xp: number };
  readonly chain?: Readonly<Partial<Insertable<ActivityChains>>>;

  readonly completedNodeIDs?: ReadonlyArray<string>;

  readonly contentVersion?: string;
  readonly document?: ContentDocument;
  readonly duration?: number;
  readonly chainRow?: Readonly<Selectable<ActivityChains>>;
  readonly secretRef?: SecretRef;
  readonly secretVersion?: number;
  readonly seed?: string;
  readonly startChainIndex?: number;
}

export async function createHonestActivityFixture(
  db: Kysely<DB>,
  input: Readonly<CreateHonestActivityFixtureInput> = {},
): Promise<HonestActivityFixture> {
  const seed = input.seed ?? buildStateFromSeed(faker.number.int());
  const buildSnapshot = input.buildSnapshot ?? { level: 1, xp: 0 };
  const activityID = input.activity?.id ?? `act_${createId()}`;
  let chain = input.chainRow;

  chain ??= await createChainRow(db, {
    appendedNextSeed: seed,
    genesisSeed: seed,
    scopeId: DEFAULT_SCOPE_ID,
    verifiedNextSeed: seed,
    ...(input.avatarID !== undefined && { avatarId: input.avatarID }),
    ...input.chain,
  });

  const startChainIndex = input.startChainIndex ?? chain.appendedChainIndex;

  invariant(
    input.document === undefined ||
      input.contentVersion === undefined ||
      input.document.contentVersion === input.contentVersion,
    'an explicit document must carry the explicit content version',
  );

  const document =
    input.document ??
    createMockContentDocument({ contentVersion: input.contentVersion ?? DEFAULT_CONTENT_VERSION });

  const contentVersion = document.contentVersion;

  // The replay worker loads content by the row's stamped version, so the document this fixture ran
  // the engine against must be readable back from the registry; a suite (or an earlier fixture)
  // may already have published the version, in which case its content is assumed identical.
  if ((await findContentDocument(db, contentVersion)) === undefined) {
    await createContentVersion(db, document);
  }

  const secretRef = input.secretRef ?? 'worldmap';
  const secretVersion = input.secretVersion ?? 1;

  // An honest run's pinned build always equals the avatar's settled xp at start — replay's build
  // re-derivation check compares against exactly this, so a fixture whose caller boosted the build
  // for combat power must carry a matching settled total or that check would reject it.
  await db
    .updateTable('avatars')
    .set({ level: buildLevelFromXP(buildSnapshot.xp), xp: buildSnapshot.xp })
    .where('id', '=', chain.avatarId)
    .execute();

  const avatarRow = await db
    .selectFrom('avatars')
    .select('seed')
    .where('id', '=', chain.avatarId)
    .executeTakeFirstOrThrow();

  const completedNodeIDs =
    input.completedNodeIDs ??
    resolveDefaultCompletedNodeIDs(avatarRow.seed, chain.scopeType, chain.scopeId);

  if (completedNodeIDs.length > 0) {
    await db
      .insertInto('avatarGrants')
      .values(
        completedNodeIDs.map((key) => ({ avatarId: chain.avatarId, key, kind: 'first_clear' })),
      )
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  const encounterNode = buildFixtureEncounterNode({
    avatarID: chain.avatarId,
    content: document.encounter,
    scopeID: chain.scopeId,
    secretRef,
    secretVersion,
    userSeed: avatarRow.seed,
  });

  const simulationInput = buildSimulationInput(document.encounter, {
    avatarID: chain.avatarId,
    buildSnapshot,
    contentVersion,
    encounterNode,
    id: activityID,
    seed,
  });

  const simulationResult = await runSimulation(simulationInput.activity, simulationInput.avatar, {
    duration: input.duration ?? 80_000,
  });

  const engineCheckpoints = buildTerminalPrefix(simulationResult.checkpoints);
  const keyVersion = 1;
  const simVersion = 'test-engine-hash';
  const startHash = buildStartHash({ contentVersion, encounterNode, keyVersion, seed, simVersion });

  const checkpoints = buildHonestCheckpointRows(engineCheckpoints, {
    seed,
    startChainIndex,
    startHash,
  });

  const activity = await createActivityRow(db, {
    ...input.activity,
    appendedHead: checkpoints.length,
    appendedTimeMs: Math.floor(engineCheckpoints.at(-1)?.time ?? 0),
    avatarId: chain.avatarId,
    buildSnapshot,
    contentVersion,
    encounterNode,
    id: activityID,
    keyVersion,
    lastHash: checkpoints.at(-1)?.hash ?? startHash,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
    secretRef,
    secretVersion,
    seed,
    simVersion,
    startChainIndex,
    startHash,
  });

  if (checkpoints.length > 0) {
    await db
      .insertInto('activityCheckpoints')
      .values(
        checkpoints.map((checkpoint) => ({
          activityId: activityID,
          hash: checkpoint.hash,
          payload: toJSON(checkpoint.payload),
          prevHash: checkpoint.prevHash,
          version: checkpoint.version,
        })),
      )
      .execute();
  }

  return { activity, chain, checkpoints, encounterNode, engineCheckpoints };
}

function resolveDefaultCompletedNodeIDs(
  userSeed: number,
  scopeType: string,
  scopeID: string,
): Array<string> {
  const originID = toNodeID(ORIGIN_CELL[0], ORIGIN_CELL[1]);

  if (scopeType !== 'world_map_node' || scopeID === originID) {
    return [];
  }

  const coord = findCellCoord(scopeID);

  if (coord === undefined) {
    return [scopeID];
  }

  const [neighbourEdge] = collectNodeEdges(userSeed, coord[0], coord[1]);

  if (neighbourEdge === undefined) {
    return [scopeID];
  }

  const [aID, bID] = neighbourEdge.id.split('|');

  invariant(aID !== undefined && bID !== undefined, 'an edge id always encodes two endpoints');

  return [aID === scopeID ? bID : aID];
}

interface BuildFixtureEncounterNodeInput {
  readonly avatarID: string;
  readonly content: EncounterContent;
  readonly scopeID: string;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
  readonly userSeed: number;
}

function buildFixtureEncounterNode(input: Readonly<BuildFixtureEncounterNodeInput>): EncounterNode {
  const coord = findCellCoord(input.scopeID);

  invariant(coord, 'a sealed honest fixture needs a coordinate-shaped chain scope id');

  const scopeSecret = buildMockScopeSecret(input.avatarID, input.secretRef, input.secretVersion);

  return {
    difficulty: getDifficulty(coord[0], coord[1]),
    ...deriveWorldmapContent(input.content, { coord, scopeSecret, userSeed: input.userSeed }),
  };
}

function buildTerminalPrefix(
  checkpoints: ReadonlyArray<ActivityCheckpoint>,
): Array<ActivityCheckpoint> {
  const terminalIndex = checkpoints.findIndex((checkpoint) =>
    TERMINAL_CHECKPOINT_TYPES.has(checkpoint.type),
  );

  return terminalIndex === -1 ? [...checkpoints] : checkpoints.slice(0, terminalIndex + 1);
}

function buildHonestCheckpointRows(
  engineCheckpoints: ReadonlyArray<ActivityCheckpoint>,
  context: Readonly<HonestCheckpointContext>,
): Array<HonestCheckpointRow> {
  let prevHash = context.startHash;
  let runningSeed = context.seed;

  return engineCheckpoints.map((checkpoint, index) => {
    const version = index + 1;
    const chainIndex = context.startChainIndex + version;
    const seed = 'seed' in checkpoint ? checkpoint.seed : runningSeed;

    const hash = buildCheckpointHash({
      chainIndex,
      entropySource: 'server-key',
      nextSeed: checkpoint.nextSeed,
      prevHash,
      seed,
      time: checkpoint.time,
      type: checkpoint.type,
      version,
    });

    const payload: CheckpointPayload = {
      chainIndex,
      entropySource: 'server-key',
      nextSeed: checkpoint.nextSeed,
      rewards: checkpoint.rewards,
      rewardSlots: checkpoint.rewardSlots,
      seed,
      time: checkpoint.time,
      type: checkpoint.type,
      ...(checkpoint.levelUp !== undefined && { levelUp: checkpoint.levelUp }),
    };

    const row: HonestCheckpointRow = { hash, payload, prevHash, version };

    prevHash = hash;
    runningSeed = checkpoint.nextSeed;

    return row;
  });
}
