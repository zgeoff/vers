import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import * as db from '@vers/mock-services/db';
import invariant from 'tiny-invariant';
import { readPendingStopIntent } from '../submission/read-pending-stop-intent';
import type { ActivityServiceClient } from '../submission/types';
import { writeActivityStart } from '../submission/write-activity-start';
import { writePendingStopIntent } from '../submission/write-pending-stop-intent';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { WorkerMessageType } from '../types';
import { runReconnectRecovery } from './run-reconnect-recovery';

async function setupTest(userID: string) {
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', userID);

  const context = createStubWorkerContext({ client });

  return { context };
}

test("it resyncs the reporting tab's avatar when an undelivered start names a different one", async () => {
  const viewer = await createViewer();
  const avatar = await db.avatarCollection.create({ userID: viewer.user.id });
  const ctx = await setupTest(viewer.user.id);

  // an undelivered activity start names this avatar, so the recovery would drain it if the
  // account were still on that avatar
  await writeActivityStart(createMockActivityData({ avatarID: avatar.id }));

  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'capped',
  });

  await runReconnectRecovery(ctx.context, viewer.avatar.id);

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: avatar.id, status: 'active' }),
  );

  expect(minted).toBeUndefined();

  expect(ctx.context.getBroadcasts()).toPartiallyContain({
    status: { kind: 'capped' },
    type: WorkerMessageType.ResyncStatus,
  });

  expect(ctx.context.getResyncAvatarID()).toBe(viewer.avatar.id);
});

test('it resyncs the reported avatar when no intent is held', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest(viewer.user.id);

  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'capped',
  });

  await runReconnectRecovery(ctx.context, viewer.avatar.id);

  expect(ctx.context.getBroadcasts()).toStrictEqual([
    { status: { kind: 'capped' }, type: WorkerMessageType.ResyncStatus },
  ]);

  expect(ctx.context.getResyncAvatarID()).toBe(viewer.avatar.id);
});

test('it falls back to the avatar of the last resync without a report', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest(viewer.user.id);

  ctx.context.setResyncAvatarID(viewer.avatar.id);

  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'capped',
  });

  await runReconnectRecovery(ctx.context);

  expect(ctx.context.getBroadcasts()).toStrictEqual([
    { status: { kind: 'capped' }, type: WorkerMessageType.ResyncStatus },
  ]);
});

test('it skips the catch-up while a run is live', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest(viewer.user.id);

  ctx.context.setActivity(createMockActivityData());

  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'capped',
  });

  await runReconnectRecovery(ctx.context, viewer.avatar.id);

  expect(ctx.context.getBroadcasts()).toStrictEqual([]);
  expect(ctx.context.getResyncAvatarID()).toBeNull();
});

test('it skips the catch-up when no source names an avatar', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest(viewer.user.id);

  await runReconnectRecovery(ctx.context);

  expect(ctx.context.getBroadcasts()).toStrictEqual([]);
  expect(ctx.context.getResyncAvatarID()).toBeNull();
});

test('it delivers a stop raised offline even when no resync follows', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest(viewer.user.id);
  const row = await db.activityCollection.create({ avatarID: viewer.avatar.id, status: 'active' });

  await writePendingStopIntent({ activityID: row.id, avatarID: viewer.avatar.id });

  // a live run gates the resync, but the stop must still deliver
  ctx.context.setActivity(createMockActivityData());

  await runReconnectRecovery(ctx.context, viewer.avatar.id);

  const stopped = db.activityCollection.findFirst((q) => q.where({ id: row.id }));

  invariant(stopped !== undefined, 'expected the targeted row to survive');

  expect(stopped.status).toBe('stopped');

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();
});
