import { expect, test } from 'bun:test';
import { buildStartHash } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import invariant from 'tiny-invariant';
import { runActivityAttempt } from './run-activity-attempt';

test('it links every checkpoint to the one before it, starting from the start hash', async () => {
  const document = createMockContentDocument({ contentVersion: '2' });

  const run = await runActivityAttempt({
    activityID: 'act_link',
    avatarID: 'avatar_link',
    buildSnapshot: { level: 3, xp: 120 },
    chain: {
      anchor: { chainIndex: 40, nextSeed: '0123456789abcdef0123456789abcdef' },
      contentVersion: '2',
      encounterNode: { difficulty: 0 },
      keyVersion: 1,
      scopeID: '0_0',
      scopeType: 'world_map_node',
    },
    content: document.encounter,
    playedAt: new Date('2026-10-26T00:00:00.000Z'),
    predecessorActivityID: null,
    simVersion: 'engine-current',
  });

  expect(run.entries.map((entry) => entry.prevHash)).toStrictEqual([
    run.start.startHash,
    ...run.entries.slice(0, -1).map((entry) => entry.hash),
  ]);
});

test('it pins the start to the chain anchor and leaves the next anchor at its last checkpoint', async () => {
  const document = createMockContentDocument({ contentVersion: '2' });

  const run = await runActivityAttempt({
    activityID: 'act_anchor',
    avatarID: 'avatar_anchor',
    buildSnapshot: { level: 3, xp: 120 },
    chain: {
      anchor: { chainIndex: 40, nextSeed: '0123456789abcdef0123456789abcdef' },
      contentVersion: '2',
      encounterNode: { difficulty: 0 },
      keyVersion: 1,
      scopeID: '0_0',
      scopeType: 'world_map_node',
    },
    content: document.encounter,
    playedAt: new Date('2026-10-26T00:00:00.000Z'),
    predecessorActivityID: 'act_before',
    simVersion: 'engine-retained',
  });

  const last = run.entries.at(-1);

  expect(run.start).toStrictEqual({
    avatarID: 'avatar_anchor',
    buildSnapshot: { level: 3, xp: 120 },
    contentVersion: '2',
    playedAt: new Date('2026-10-26T00:00:00.000Z'),
    predecessorActivityID: 'act_before',
    scopeID: '0_0',
    scopeType: 'world_map_node',
    seed: '0123456789abcdef0123456789abcdef',
    simVersion: 'engine-retained',
    startChainIndex: 40,
    startHash: buildStartHash({
      contentVersion: '2',
      encounterNode: { difficulty: 0 },
      keyVersion: 1,
      seed: '0123456789abcdef0123456789abcdef',
      simVersion: 'engine-retained',
    }),
    startKey: 'load_act_anchor',
  });

  invariant(last !== undefined);

  expect(run.nextAnchor).toStrictEqual({
    chainIndex: 40 + run.entries.length,
    nextSeed: last.payload.nextSeed,
  });
});

test('it ends on the terminal checkpoint of one attempt and adds its XP to the next build', async () => {
  const document = createMockContentDocument({ contentVersion: '2' });

  const run = await runActivityAttempt({
    activityID: 'act_terminal',
    avatarID: 'avatar_terminal',
    buildSnapshot: { level: 3, xp: 120 },
    chain: {
      anchor: { chainIndex: 0, nextSeed: '0123456789abcdef0123456789abcdef' },
      contentVersion: '2',
      encounterNode: { difficulty: 0 },
      keyVersion: 1,
      scopeID: '0_0',
      scopeType: 'world_map_node',
    },
    content: document.encounter,
    playedAt: new Date('2026-10-26T00:00:00.000Z'),
    predecessorActivityID: null,
    simVersion: 'engine-current',
  });

  expect(run.entries.at(-1)?.payload.type).toBe(run.outcome);
  expect(run.nextBuildSnapshot.xp).toBe(120 + run.xpTotal);
});

test('it builds the same run for the same input', async () => {
  const document = createMockContentDocument({ contentVersion: '2' });

  const input = {
    activityID: 'act_same',
    avatarID: 'avatar_same',
    buildSnapshot: { level: 1, xp: 0 },
    chain: {
      anchor: { chainIndex: 0, nextSeed: '0123456789abcdef0123456789abcdef' },
      contentVersion: '2',
      encounterNode: { difficulty: 0 },
      keyVersion: 1,
      scopeID: '0_0',
      scopeType: 'world_map_node',
    },
    content: document.encounter,
    playedAt: new Date('2026-10-26T00:00:00.000Z'),
    predecessorActivityID: null,
    simVersion: 'engine-current',
  };

  const first = await runActivityAttempt(input);
  const second = await runActivityAttempt(input);

  expect(first).toStrictEqual(second);
});
