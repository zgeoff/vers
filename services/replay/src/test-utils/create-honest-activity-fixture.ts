import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import { buildCheckpointHash, buildStartHash } from '@vers/contract-activity';
import type { Activities, ActivityChains, DB, Json } from '@vers/db';
import { buildStateFromSeed } from '@vers/game-utils';
import type { ActivityCheckpoint } from '@vers/idle-core';
import { runSimulation } from '@vers/idle-core/replay';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { buildReplaySimulationInput } from '../replay/build-replay-simulation-input';
import { createActivityRow } from './create-activity-row';
import { createChainRow } from './create-chain-row';

interface HonestCheckpointRow {
  readonly hash: string;
  readonly payload: Record<string, unknown>;
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
  readonly engineCheckpoints: ReadonlyArray<ActivityCheckpoint>;
}

interface CreateHonestActivityFixtureInput {
  readonly activity?: Readonly<Partial<Insertable<Activities>>>;
  readonly avatarID?: string;
  readonly buildSnapshot?: { readonly level: number; readonly xp: number };
  readonly chain?: Readonly<Partial<Insertable<ActivityChains>>>;
  readonly duration?: number;
  readonly seed?: string;
}

/**
 * Builds and persists a chain's first activity by running the real engine — never a hand-crafted
 * stream — and hashing its output the same way the append path does, so the stored rows are
 * byte-identical to what an honest client would have submitted. `checkpoints` are the stored
 * rows a tamper test mutates; `engineCheckpoints` is the untouched engine output.
 */
export async function createHonestActivityFixture(
  db: Kysely<DB>,
  input: Readonly<CreateHonestActivityFixtureInput> = {},
): Promise<HonestActivityFixture> {
  const seed = input.seed ?? buildStateFromSeed(faker.number.int());
  const buildSnapshot = input.buildSnapshot ?? { level: 1, xp: 0 };
  const activityID = input.activity?.id ?? `act_${createId()}`;

  const chain = await createChainRow(db, {
    appendedNextSeed: seed,
    genesisSeed: seed,
    verifiedNextSeed: seed,
    ...(input.avatarID !== undefined && { avatarId: input.avatarID }),
    ...input.chain,
  });

  const simulationInput = buildReplaySimulationInput({
    avatarID: chain.avatarId,
    buildSnapshot,
    id: activityID,
    seed,
  });

  const simulationResult = await runSimulation(simulationInput.activity, simulationInput.avatar, {
    duration: input.duration ?? 80_000,
  });

  const engineCheckpoints = simulationResult.checkpoints;
  const contentVersion = '0.0.0-dev';
  const keyVersion = 1;
  const simVersion = 'test-engine-hash';

  const startHash = buildStartHash({
    activityID,
    contentVersion,
    keyVersion,
    seed,
    simVersion,
  });

  const checkpoints = buildHonestCheckpointRows(engineCheckpoints, {
    seed,
    startChainIndex: chain.appendedChainIndex,
    startHash,
  });

  const activity = await createActivityRow(db, {
    appendedHead: checkpoints.length,
    avatarId: chain.avatarId,
    buildSnapshot,
    contentVersion,
    id: activityID,
    keyVersion,
    lastHash: checkpoints.at(-1)?.hash ?? startHash,
    scopeId: chain.scopeId,
    scopeType: chain.scopeType,
    seed,
    simVersion,
    startChainIndex: chain.appendedChainIndex,
    startHash,
    ...input.activity,
  });

  if (checkpoints.length > 0) {
    await db
      .insertInto('activityCheckpoints')
      .values(
        checkpoints.map((checkpoint) => ({
          activityId: activityID,
          hash: checkpoint.hash,
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; the value is a hand-built, schema-shaped payload
          payload: checkpoint.payload as Json,
          prevHash: checkpoint.prevHash,
          version: checkpoint.version,
        })),
      )
      .execute();
  }

  return { activity, chain, checkpoints, engineCheckpoints };
}

/**
 * Reproduces the append path's own hash chain over a fresh engine run: `chainIndex` counts from
 * the activity's own `startChainIndex` (always zero for a fixture's first activity), the
 * entropy-source tag is always `server-key`, and each checkpoint's implicit `seed` is the prior
 * checkpoint's `nextSeed` — every field the real append path would have recomputed identically.
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

    const payload = {
      chainIndex,
      entropySource: 'server-key',
      nextSeed: checkpoint.nextSeed,
      rewards: checkpoint.rewards,
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
