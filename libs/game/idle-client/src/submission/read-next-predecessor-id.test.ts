import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { readAllActivityStarts } from './read-all-activity-starts';
import { readNextPredecessorID } from './read-next-predecessor-id';
import { writeActivityStart } from './write-activity-start';
import { writeLastStartedActivity } from './write-last-started-activity';

test('it reads null for an avatar with no last-started record and no pending start', () => {
  expect(readNextPredecessorID('avatar_fresh')).resolves.toBeNull();
});

test('it reads the last-started activity when no pending start follows it', async () => {
  await writeLastStartedActivity({ avatarID: 'avatar_settled', lastActivityID: 'act_settled' });

  expect(readNextPredecessorID('avatar_settled')).resolves.toBe('act_settled');
});

test('it reads a pending start that its last-started record never reached, and keeps the start', async () => {
  const orphan = createMockActivityData({
    avatarID: 'avatar_orphan',
    id: 'act_orphan',
    predecessorActivityID: 'act_recorded',
  });

  await writeLastStartedActivity({ avatarID: 'avatar_orphan', lastActivityID: 'act_recorded' });
  await writeActivityStart(orphan);

  const predecessorID = await readNextPredecessorID('avatar_orphan');
  const starts = await readAllActivityStarts();

  expect(predecessorID).toBe('act_orphan');
  expect(starts).toStrictEqual([orphan]);
});

test("it reads a pending first start that its avatar's last-started record never reached", async () => {
  await writeActivityStart(
    createMockActivityData({
      avatarID: 'avatar_first',
      id: 'act_first',
      predecessorActivityID: null,
    }),
  );

  expect(readNextPredecessorID('avatar_first')).resolves.toBe('act_first');
});

test('it follows a chain of pending starts to its last one', async () => {
  await writeLastStartedActivity({ avatarID: 'avatar_chain', lastActivityID: 'act_chain_root' });

  await writeActivityStart(
    createMockActivityData({
      avatarID: 'avatar_chain',
      id: 'act_chain_second',
      predecessorActivityID: 'act_chain_first',
    }),
  );

  await writeActivityStart(
    createMockActivityData({
      avatarID: 'avatar_chain',
      id: 'act_chain_first',
      predecessorActivityID: 'act_chain_root',
    }),
  );

  expect(readNextPredecessorID('avatar_chain')).resolves.toBe('act_chain_second');
});

test('it follows the latest-created of two pending starts that name the same predecessor', async () => {
  await writeLastStartedActivity({ avatarID: 'avatar_fork', lastActivityID: 'act_fork_root' });

  await writeActivityStart(
    createMockActivityData({
      avatarID: 'avatar_fork',
      createdAt: new Date('2026-03-02T10:00:00.000Z'),
      id: 'act_fork_later',
      predecessorActivityID: 'act_fork_root',
    }),
  );

  await writeActivityStart(
    createMockActivityData({
      avatarID: 'avatar_fork',
      createdAt: new Date('2026-03-02T09:00:00.000Z'),
      id: 'act_fork_earlier',
      predecessorActivityID: 'act_fork_root',
    }),
  );

  expect(readNextPredecessorID('avatar_fork')).resolves.toBe('act_fork_later');
});

test("it never follows another avatar's pending start", async () => {
  await writeLastStartedActivity({ avatarID: 'avatar_own', lastActivityID: 'act_shared_id' });

  await writeActivityStart(
    createMockActivityData({
      avatarID: 'avatar_foreign',
      id: 'act_foreign',
      predecessorActivityID: 'act_shared_id',
    }),
  );

  expect(readNextPredecessorID('avatar_own')).resolves.toBe('act_shared_id');
});
