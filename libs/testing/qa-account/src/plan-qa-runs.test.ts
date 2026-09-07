import { expect, test } from 'bun:test';
import { EncounterNodeSchema, buildCheckpointHash, buildStartHash } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import type { AvatarItems } from '@vers/db';
import { buildLevelFromXP } from '@vers/idle-core';
import type { Insertable } from 'kysely';
import invariant from 'tiny-invariant';
import { planQARuns } from './plan-qa-runs';

test('it stores a checkpoint chain whose hashes byte-match a fresh recompute', async () => {
  const plan = await planQARuns({
    activityIDs: ['act_one'],
    avatarID: 'avatar_one',
    document: createMockContentDocument({ contentVersion: '2' }),
    genesisSeed: '0123456789abcdef0123456789abcdef',
    keyVersion: 1,
    now: new Date('2026-09-08T00:00:00Z'),
    rollKey: new Uint8Array(32).fill(2),
    scopeSecret: new Uint8Array(32).fill(1),
    secretRef: 'worldmap',
    secretVersion: 1,
    simVersion: 'engine-hash',
    startXP: 2500,
    userSeed: 7,
  });

  const [run] = plan.runs;

  invariant(run !== undefined, 'one activity id plans one run');

  let prevHash = run.activity.startHash;

  for (const checkpoint of run.checkpoints) {
    const recomputed = buildCheckpointHash({
      chainIndex: checkpoint.payload.chainIndex,
      entropySource: 'server-key',
      nextSeed: checkpoint.payload.nextSeed,
      prevHash,
      seed: checkpoint.payload.seed,
      time: checkpoint.payload.time,
      type: checkpoint.payload.type,
      version: checkpoint.version,
    });

    expect(checkpoint.hash).toBe(recomputed);
    expect(checkpoint.prevHash).toBe(prevHash);

    prevHash = checkpoint.hash;
  }

  expect(run.activity.lastHash).toBe(prevHash);
});

test('it plans a fully delivered and verified run that ends on a terminal checkpoint', async () => {
  const plan = await planQARuns({
    activityIDs: ['act_one'],
    avatarID: 'avatar_one',
    document: createMockContentDocument({ contentVersion: '2' }),
    genesisSeed: '0123456789abcdef0123456789abcdef',
    keyVersion: 1,
    now: new Date('2026-09-08T00:00:00Z'),
    rollKey: new Uint8Array(32).fill(2),
    scopeSecret: new Uint8Array(32).fill(1),
    secretRef: 'worldmap',
    secretVersion: 1,
    simVersion: 'engine-hash',
    startXP: 2500,
    userSeed: 7,
  });

  const [run] = plan.runs;

  invariant(run !== undefined, 'one activity id plans one run');

  const first = run.checkpoints.at(0);
  const last = run.checkpoints.at(-1);

  invariant(first !== undefined && last !== undefined, 'a run stores at least one checkpoint');

  expect(first.payload.type).toBe('started');
  expect(last.payload.type).toBeOneOf(['completed', 'failed']);
  expect(run.outcome).toBe('completed');

  expect(run.activity).toMatchObject({
    appendedHead: run.checkpoints.length,
    appendedTimeMs: Math.floor(last.payload.time),
    buildSnapshot: { level: buildLevelFromXP(2500), xp: 2500 },
    predecessorActivityId: null,
    scopeId: '0_0',
    scopeType: 'world_map_node',
    settledXp: run.xpDelta,
    startChainIndex: 0,
    status: 'stopped',
    verifiedHead: run.checkpoints.length,
    writerSessionId: null,
  });

  expect(run.activity.startHash).toBe(
    buildStartHash({
      contentVersion: '2',
      encounterNode: EncounterNodeSchema.parse(run.activity.encounterNode),
      keyVersion: 1,
      seed: '0123456789abcdef0123456789abcdef',
      simVersion: 'engine-hash',
    }),
  );

  expect(plan.clearedNodeIDs).toStrictEqual(['0_0']);
  expect(plan.finalXP).toBe(2500 + run.xpDelta);
});

test('it starts each later run on the previous tail and names it as the predecessor', async () => {
  const plan = await planQARuns({
    activityIDs: ['act_one', 'act_two', 'act_three'],
    avatarID: 'avatar_one',
    document: createMockContentDocument({ contentVersion: '2' }),
    genesisSeed: '0123456789abcdef0123456789abcdef',
    keyVersion: 1,
    now: new Date('2026-09-08T00:00:00Z'),
    rollKey: new Uint8Array(32).fill(2),
    scopeSecret: new Uint8Array(32).fill(1),
    secretRef: 'worldmap',
    secretVersion: 1,
    simVersion: 'engine-hash',
    startXP: 0,
    userSeed: 7,
  });

  const [first, second, third] = plan.runs;

  invariant(first && second && third, 'three activity ids plan three runs');

  const firstTail = first.checkpoints.at(-1);
  const secondTail = second.checkpoints.at(-1);
  const thirdTail = third.checkpoints.at(-1);

  invariant(firstTail && secondTail && thirdTail, 'each run stores its terminal checkpoint');

  expect(second.activity).toMatchObject({
    predecessorActivityId: 'act_one',
    seed: firstTail.payload.nextSeed,
    startChainIndex: firstTail.payload.chainIndex,
  });

  expect(third.activity).toMatchObject({
    predecessorActivityId: 'act_two',
    seed: secondTail.payload.nextSeed,
    startChainIndex: secondTail.payload.chainIndex,
  });

  expect(second.activity.buildSnapshot).toStrictEqual({
    level: buildLevelFromXP(first.xpDelta),
    xp: first.xpDelta,
  });

  expect(plan.chain).toStrictEqual({
    appendedChainIndex: thirdTail.payload.chainIndex,
    appendedNextSeed: thirdTail.payload.nextSeed,
    avatarId: 'avatar_one',
    genesisSeed: '0123456789abcdef0123456789abcdef',
    scopeId: '0_0',
    scopeType: 'world_map_node',
    verifiedChainIndex: thirdTail.payload.chainIndex,
    verifiedNextSeed: thirdTail.payload.nextSeed,
  });

  invariant(
    second.activity.startedAt instanceof Date && third.activity.startedAt instanceof Date,
    'a planned run stamps its start as a Date',
  );

  expect(first.activity.startedAt).toBeBefore(second.activity.startedAt);
  expect(second.activity.startedAt).toBeBefore(third.activity.startedAt);
});

test("it rolls one item row per reward slot at that slot's chain position", async () => {
  const plan = await planQARuns({
    activityIDs: ['act_one'],
    avatarID: 'avatar_one',
    document: createMockContentDocument({ contentVersion: '2' }),
    genesisSeed: '0123456789abcdef0123456789abcdef',
    keyVersion: 1,
    now: new Date('2026-09-08T00:00:00Z'),
    rollKey: new Uint8Array(32).fill(2),
    scopeSecret: new Uint8Array(32).fill(1),
    secretRef: 'worldmap',
    secretVersion: 1,
    simVersion: 'engine-hash',
    startXP: 2500,
    userSeed: 7,
  });

  const [run] = plan.runs;

  invariant(run !== undefined, 'one activity id plans one run');

  const slots = run.checkpoints.flatMap((checkpoint) => {
    const rewardSlots = checkpoint.payload['rewardSlots'];

    invariant(Array.isArray(rewardSlots), 'a planned payload carries its reward slots');

    return rewardSlots.map(() => checkpoint.payload.chainIndex);
  });

  expect(run.items.map((item) => item.chainIndex)).toStrictEqual(slots);

  expect(run.items).toSatisfyAll(
    (item: Readonly<Insertable<AvatarItems>>) =>
      item.avatarId === 'avatar_one' && item.keyVersion === 1 && item.scopeId === '0_0',
  );
});

test('it plans the same rows for the same inputs', async () => {
  const input = {
    activityIDs: ['act_one', 'act_two'],
    avatarID: 'avatar_one',
    document: createMockContentDocument({ contentVersion: '2' }),
    genesisSeed: '0123456789abcdef0123456789abcdef',
    keyVersion: 1,
    now: new Date('2026-09-08T00:00:00Z'),
    rollKey: new Uint8Array(32).fill(2),
    scopeSecret: new Uint8Array(32).fill(1),
    secretRef: 'worldmap' as const,
    secretVersion: 1,
    simVersion: 'engine-hash',
    startXP: 2500,
    userSeed: 7,
  };

  const first = await planQARuns(input);
  const second = await planQARuns(input);

  expect(first).toStrictEqual(second);
});
