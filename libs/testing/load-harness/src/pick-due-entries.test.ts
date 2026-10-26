import { expect, test } from 'bun:test';
import { MAX_CATCH_UP_BATCH_CHECKPOINTS } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import invariant from 'tiny-invariant';
import { pickDueEntries } from './pick-due-entries';
import { runActivityAttempt } from './run-activity-attempt';

test('it picks the unsent checkpoints the simulation has reached', async () => {
  const document = createMockContentDocument({ contentVersion: '2' });

  const run = await runActivityAttempt({
    activityID: 'act_due',
    avatarID: 'avatar_due',
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
  });

  expect(pickDueEntries(run.entries, 1, 7000)).toStrictEqual(run.entries.slice(1, 3));
});

test('it picks every checkpoint that shares the reached time', async () => {
  const document = createMockContentDocument({ contentVersion: '2' });

  const run = await runActivityAttempt({
    activityID: 'act_due',
    avatarID: 'avatar_due',
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
  });

  const last = run.entries.at(-1);

  invariant(last !== undefined);

  expect(pickDueEntries(run.entries, 0, last.payload.time)).toStrictEqual([...run.entries]);
});

test('it picks at most one batch of checkpoints', async () => {
  const document = createMockContentDocument({ contentVersion: '2' });

  const run = await runActivityAttempt({
    activityID: 'act_due',
    avatarID: 'avatar_due',
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
  });

  const [first] = run.entries;

  invariant(first !== undefined);

  const queued = Array.from({ length: MAX_CATCH_UP_BATCH_CHECKPOINTS + 20 }, () => first);

  expect(pickDueEntries(queued, 0, 0)).toHaveLength(MAX_CATCH_UP_BATCH_CHECKPOINTS);
});

test('it picks nothing before the simulation reaches the next checkpoint', async () => {
  const document = createMockContentDocument({ contentVersion: '2' });

  const run = await runActivityAttempt({
    activityID: 'act_due',
    avatarID: 'avatar_due',
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
  });

  expect(pickDueEntries(run.entries, 1, 2499)).toStrictEqual([]);
});

test('it picks nothing once every checkpoint is sent', async () => {
  const document = createMockContentDocument({ contentVersion: '2' });

  const run = await runActivityAttempt({
    activityID: 'act_due',
    avatarID: 'avatar_due',
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
  });

  expect(pickDueEntries(run.entries, run.entries.length, Number.MAX_SAFE_INTEGER)).toStrictEqual(
    [],
  );
});
