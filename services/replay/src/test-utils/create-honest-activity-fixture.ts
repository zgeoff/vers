import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { CheckpointPayload, ContentDocument, EncounterNode } from '@vers/contract-activity';
import {
  ContentDocumentSchema,
  buildCheckpointHash,
  buildStartHash,
} from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import type { Activities, ActivityChains, DB } from '@vers/db';
import { contentDocumentV1, contentDocumentV2, toJSON } from '@vers/db';
import { buildStateFromSeed } from '@vers/game-utils';
import type { EncounterContent } from '@vers/game-utils';
import type { ActivityCheckpoint } from '@vers/idle-core';
import { buildSimulationInput } from '@vers/idle-core';
import { runSimulation } from '@vers/idle-core/replay';
import { buildMockScopeSecret } from '@vers/mock-services/keys';
import { deriveWorldmapContent } from '@vers/worldmap-content';
import { findCellCoord, getDifficulty } from '@vers/worldmap-core';
import type { Insertable, Kysely, Selectable } from 'kysely';
import invariant from 'tiny-invariant';
import { TERMINAL_CHECKPOINT_TYPES } from '../replay/types';
import { createActivityRow } from './create-activity-row';
import { createChainRow } from './create-chain-row';

/**
 * The chain scope id every honest fixture roots on unless the caller overrides it: a real cell
 * coordinate whose difficulty is 1, so sealed and legacy fixtures stamp the same difficulty and
 * stay byte-comparable.
 */
const DEFAULT_SCOPE_ID = '1_0';

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

  /**
   * The node exactly as this fixture authored it before insert, typed — callers assert loader
   * output against it instead of re-shaping the row's untyped jsonb.
   */
  readonly encounterNode: EncounterNode;

  readonly engineCheckpoints: ReadonlyArray<ActivityCheckpoint>;
}

interface CreateHonestActivityFixtureInput {
  readonly activity?: Readonly<Partial<Insertable<Activities>>>;
  readonly avatarID?: string;
  readonly buildSnapshot?: { readonly level: number; readonly xp: number };
  readonly chain?: Readonly<Partial<Insertable<ActivityChains>>>;
  readonly contentVersion?: string;
  readonly duration?: number;
  readonly rootChain?: Readonly<Selectable<ActivityChains>>;
  readonly secretRef?: SecretRef;
  readonly secretVersion?: number;
  readonly seed?: string;
  readonly startChainIndex?: number;
}

/**
 * Builds and persists an honest activity by running the real engine — never a hand-crafted stream
 * — and hashing its output the same way the append path does, so the stored rows are
 * byte-identical to what an honest client would have submitted. The engine output is truncated at
 * its first terminal checkpoint: the append path ends an activity's append-ability on the first
 * `completed`/`failed` checkpoint it accepts, so a stored stream past that point is a shape the
 * server can never actually hold, however long a duration the engine ran for. `checkpoints` are
 * the stored rows a tamper test mutates; `engineCheckpoints` is the untouched (truncated) engine
 * output. `rootChain` roots this activity on an already-persisted chain instead of creating a
 * fresh one — a successor fixture's own way of sharing its predecessor's chain — and defaults
 * `startChainIndex` to that chain's own `appendedChainIndex`; pass both explicitly for a successor
 * seeded from a predecessor's tail rather than the chain's current appended anchor. Every row is
 * sealed: `secretRef`/`secretVersion` stamped and the encounter node's sealed fields derived
 * through the real content derivation over the mock keys backend's deterministic scope secret, so
 * a caller verifying through that same backend sees identical truth.
 */
export async function createHonestActivityFixture(
  db: Kysely<DB>,
  input: Readonly<CreateHonestActivityFixtureInput> = {},
): Promise<HonestActivityFixture> {
  const seed = input.seed ?? buildStateFromSeed(faker.number.int());
  const buildSnapshot = input.buildSnapshot ?? { level: 1, xp: 0 };
  const activityID = input.activity?.id ?? `act_${createId()}`;
  let chain = input.rootChain;

  chain ??= await createChainRow(db, {
    appendedNextSeed: seed,
    genesisSeed: seed,
    scopeId: DEFAULT_SCOPE_ID,
    verifiedNextSeed: seed,
    ...(input.avatarID !== undefined && { avatarId: input.avatarID }),
    ...input.chain,
  });

  const startChainIndex = input.startChainIndex ?? chain.appendedChainIndex;
  const contentVersion = input.contentVersion ?? '2';

  invariant(
    contentVersion === '1' || contentVersion === '2',
    `no seeded content document exists for content version ${contentVersion}`,
  );

  const contentSource = contentVersion === '1' ? contentDocumentV1 : contentDocumentV2;
  const document: ContentDocument = ContentDocumentSchema.parse(contentSource);
  const secretRef = input.secretRef ?? 'worldmap';
  const secretVersion = input.secretVersion ?? 1;

  const encounterNode = buildFixtureEncounterNode({
    avatarID: chain.avatarId,
    content: document.encounter,
    scopeID: chain.scopeId,
    secretRef,
    secretVersion,
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

interface BuildFixtureEncounterNodeInput {
  readonly avatarID: string;
  readonly content: EncounterContent;
  readonly scopeID: string;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
}

/**
 * Resolves the encounter node a fixture stamps: difficulty recomputed from the fixture's own
 * scope id, plus every sealed content field the real content derivation yields for the mock keys
 * backend's deterministic scope secret — the same truth a verifier reading through that backend
 * recomputes.
 */
function buildFixtureEncounterNode(input: Readonly<BuildFixtureEncounterNodeInput>): EncounterNode {
  const coord = findCellCoord(input.scopeID);

  invariant(coord, 'a sealed honest fixture needs a coordinate-shaped chain scope id');

  const scopeSecret = buildMockScopeSecret(input.avatarID, input.secretRef, input.secretVersion);

  return {
    difficulty: getDifficulty(coord[0], coord[1]),
    ...deriveWorldmapContent(input.content, { coord, scopeSecret, userSeed: 0 }),
  };
}

/**
 * Cuts the engine's output at its first `completed`/`failed` checkpoint, inclusive — the shape a
 * stored stream is always found in, since the append path accepts nothing past a terminal.
 */
function buildTerminalPrefix(
  checkpoints: ReadonlyArray<ActivityCheckpoint>,
): Array<ActivityCheckpoint> {
  const terminalIndex = checkpoints.findIndex((checkpoint) =>
    TERMINAL_CHECKPOINT_TYPES.has(checkpoint.type),
  );

  return terminalIndex === -1 ? [...checkpoints] : checkpoints.slice(0, terminalIndex + 1);
}

/**
 * Reproduces the append path's own hash chain over a fresh engine run: `chainIndex` counts from
 * the activity's own `startChainIndex`, the entropy-source tag is always `server-key`, and each
 * checkpoint's implicit `seed` is the prior checkpoint's `nextSeed` — every field the real append
 * path would have recomputed identically.
 */
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
