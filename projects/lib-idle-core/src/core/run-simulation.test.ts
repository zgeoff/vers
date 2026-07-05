import { expect, test } from 'vitest';
import { createMockActivityData } from '../test-utils/create-mock-activity-data';
import { createMockAvatarData } from '../test-utils/create-mock-avatar-data';
import { createMockEnemyData } from '../test-utils/create-mock-enemy-data';
import { ActivityCheckpointType, ActivityFailureAction, ActivityType } from '../types';
import { runSimulation } from './run-simulation';

test('runs a simulation with default configuration', async () => {
  const avatar = createMockAvatarData();

  const activity = createMockActivityData({
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Retry,
    id: 'aether_node_1',
    seed: 3_047_525_658,
    type: ActivityType.AetherNode,
  });

  const config = {
    duration: 80_000,
  };

  const result = await runSimulation(activity, avatar, config);

  // oxlint-disable-next-line vitest/no-large-snapshots -- the snapshot is the full deterministic simulation transcript; its size is the assertion
  expect(result).toMatchInlineSnapshot(`
    {
      "checkpoints": [
        {
          "hash": "cbd6cc9427a79b1e",
          "seed": 3047525658,
          "time": 0,
          "type": "started",
        },
        {
          "hash": "611b08f1de148c51",
          "nextSeed": 685112472,
          "time": 16300,
          "type": "progress",
        },
        {
          "hash": "d0100e711451eca4",
          "nextSeed": 2866488649,
          "time": 36300,
          "type": "progress",
        },
        {
          "hash": "754e2d41cc9f551d",
          "nextSeed": 2249575321,
          "time": 46300,
          "type": "progress",
        },
        {
          "hash": "e9f8306aa299f8cc",
          "nextSeed": 3183217100,
          "time": 57600,
          "type": "progress",
        },
        {
          "hash": "0ad2f691a6d94aa0",
          "nextSeed": 4197947599,
          "time": 57600,
          "type": "completed",
        },
        {
          "hash": "f1dd0c3fcae677d9",
          "seed": 4197947599,
          "time": 0,
          "type": "started",
        },
        {
          "hash": "18975faf33fdc719",
          "nextSeed": 2381219441,
          "time": 18800,
          "type": "progress",
        },
      ],
      "elapsed": 80000,
    }
  `);
});

test('it respects duration limit and stops the simulation accordingly', async () => {
  const avatar = createMockAvatarData();

  const activity = createMockActivityData({
    enemies: [createMockEnemyData()],
    failureAction: ActivityFailureAction.Retry,
    id: 'aether_node_1',
    seed: 3_047_525_658,
    type: ActivityType.AetherNode,
  });

  const config = {
    // the first group is killed at ~17 seconds on this seed
    duration: 10_000,
  };

  const result = await runSimulation(activity, avatar, config);

  expect(result.checkpoints).toHaveLength(1);
  expect(result.checkpoints[0]?.type).toBe(ActivityCheckpointType.Started);
  expect(result.elapsed).toBe(10_000);
});

test('it stops at the specified seed if provided', async () => {
  const avatar = createMockAvatarData();
  const enemy = createMockEnemyData();

  const activity = createMockActivityData({
    enemies: [enemy],
    failureAction: ActivityFailureAction.Retry,
    id: 'aether_node_1',
    seed: 3_047_525_658,
    type: ActivityType.AetherNode,
  });

  const config = {
    // set a long duration so we always reach the right value
    duration: 200_000,

    // when our algo changes, can just pull this seed to something valid from our
    // happy path snapshot test ouput
    stopAtSeed: 4_197_947_599,
  };

  const result = await runSimulation(activity, avatar, config);

  const [finalCheckpoint] = result.checkpoints.slice(-1);

  expect(finalCheckpoint).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    hash: expect.any(String),
    nextSeed: config.stopAtSeed,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    time: expect.any(Number),
    type: ActivityCheckpointType.Completed,
  });
});

test('it aborts on failure if failure action is set to abort', async () => {
  // set our life to 1 so we die immediately
  const avatar = createMockAvatarData({ life: 1 });
  const enemy = createMockEnemyData();

  const activity = createMockActivityData({
    enemies: [enemy],
    failureAction: ActivityFailureAction.Abort,
    id: 'aether_node_1',
    seed: 3_047_525_658,
    type: ActivityType.AetherNode,
  });

  const config = {
    duration: 100_000,
  };

  const result = await runSimulation(activity, avatar, config);

  const failedCheckpoints = result.checkpoints.filter(
    (cp) => cp.type === ActivityCheckpointType.Failed,
  );

  expect(failedCheckpoints).toHaveLength(1);

  const lastCheckpoint = result.checkpoints.at(-1);

  expect(lastCheckpoint).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    hash: expect.any(String),
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    nextSeed: expect.any(Number),
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    time: expect.any(Number),
    type: ActivityCheckpointType.Failed,
  });
});

test('it retries when failure action is set to retry', async () => {
  // set our life to 1 so we die immediately
  const avatar = createMockAvatarData({ life: 1 });
  const enemy = createMockEnemyData();

  const activity = createMockActivityData({
    enemies: [enemy],
    failureAction: ActivityFailureAction.Retry,
    id: 'aether_node_1',
    seed: 3_047_525_658,
    type: ActivityType.AetherNode,
  });

  const config = {
    duration: 10_000,
  };

  const result = await runSimulation(activity, avatar, config);

  const failedCheckpoints = result.checkpoints.filter(
    (cp) => cp.type === ActivityCheckpointType.Failed,
  );

  expect(failedCheckpoints.length).toBeGreaterThan(1);
});
