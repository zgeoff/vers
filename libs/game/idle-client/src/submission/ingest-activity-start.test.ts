import { expect, mock, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createAuthedServiceClient, createViewer, resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { HttpResponse } from 'msw';
import { server } from '../mocks/node';
import { ingestActivityStart } from './ingest-activity-start';
import { readActivityStart } from './read-activity-start';
import type { ActivityServiceClient } from './types';
import { writeActivityStart } from './write-activity-start';

function setupTest() {
  const link = new RPCLink({ url: `${resolveServiceURL('activity')}/rpc` });

  const client: ActivityServiceClient = createORPCClient(link);

  return { client };
}

test('it ingests a pending activityStart and removes its durable row', async () => {
  const ctx = setupTest();
  const row = createMockActivityData({ id: 'act_ingest_ok', startKey: 'start_key_ok' });

  server.use(
    mockActivityService.advanceActivity.handler(() => ({ activity: row, appendedHead: 0 })),
  );

  await writeActivityStart(row);

  const outcome = await ingestActivityStart(ctx.client, row.id);

  expect(outcome.outcome).toBe('ingested');

  const stored = await readActivityStart(row.id);

  expect(stored).toBeUndefined();
});

test('it reports absent for an activity id this device holds no pending activityStart for', async () => {
  const ctx = setupTest();

  const outcome = await ingestActivityStart(ctx.client, 'act_ingest_absent');

  expect(outcome.outcome).toBe('absent');
});

test('it reports the activityStart undelivered and keeps it on a transport failure', async () => {
  const ctx = setupTest();
  const row = createMockActivityData({ id: 'act_ingest_transport', startKey: 'start_key_t' });

  server.use(mockActivityService.advanceActivity.handler(() => HttpResponse.error()));

  await writeActivityStart(row);

  const outcome = await ingestActivityStart(ctx.client, row.id);

  expect(outcome.outcome).toBe('undelivered');

  const stored = await readActivityStart(row.id);

  expect(stored).toStrictEqual(row);
});

test('it defers and keeps the activityStart when the avatar reads temporarily inactive', async () => {
  const ctx = setupTest();
  const row = createMockActivityData({ id: 'act_ingest_inactive', startKey: 'start_key_i' });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.AVATAR_NOT_ACTIVE({
        data: { activeAvatarID: 'avatar_other', activeAvatarName: 'Other' },
      });
    }),
  );

  await writeActivityStart(row);

  const outcome = await ingestActivityStart(ctx.client, row.id);

  expect(outcome.outcome).toBe('deferred');

  const stored = await readActivityStart(row.id);

  expect(stored).toStrictEqual(row);
});

test('it rejects and removes a row with no start key without reaching the server', async () => {
  const ctx = setupTest();
  const row = createMockActivityData({ id: 'act_ingest_no_key', startKey: null });
  const track = mock<() => void>();

  server.use(
    mockActivityService.advanceActivity.handler(() => {
      track();

      return { activity: row, appendedHead: 0 };
    }),
  );

  await writeActivityStart(row);

  const outcome = await ingestActivityStart(ctx.client, row.id);

  expect(outcome.outcome).toBe('rejected');
  expect(track).not.toHaveBeenCalled();

  const stored = await readActivityStart(row.id);

  expect(stored).toBeUndefined();
});

test('it rejects and removes the activityStart once the server refuses it with NODE_NOT_REVEALED', async () => {
  const ctx = setupTest();
  const row = createMockActivityData({ id: 'act_ingest_rejected', startKey: 'start_key_c' });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.NODE_NOT_REVEALED({ data: {} });
    }),
  );

  await writeActivityStart(row);

  const outcome = await ingestActivityStart(ctx.client, row.id);

  expect(outcome.outcome).toBe('rejected');

  const stored = await readActivityStart(row.id);

  expect(stored).toBeUndefined();
});

test('it defers an order-sensitive CONFLICT, keeping the activityStart for a later retry', async () => {
  const ctx = setupTest();
  const row = createMockActivityData({ id: 'act_ingest_conflict', startKey: 'start_key_d' });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CONFLICT({
        data: { activityID: row.id, appendedHead: 3, avatarID: row.avatarID, reason: 'stale-head' },
      });
    }),
  );

  await writeActivityStart(row);

  const outcome = await ingestActivityStart(ctx.client, row.id);

  expect(outcome.outcome).toBe('deferred');

  const stored = await readActivityStart(row.id);

  expect(stored).toBeDefined();
});

test('it rejects and removes the activityStart on a permanent start-hash-mismatch', async () => {
  const ctx = setupTest();
  const row = createMockActivityData({ id: 'act_ingest_start_hash', startKey: 'start_key_e' });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CHECKPOINT_INVALID({
        data: {
          activityID: row.id,
          appendedHead: 0,
          avatarID: row.avatarID,
          reason: 'start-hash-mismatch',
        },
      });
    }),
  );

  await writeActivityStart(row);

  const outcome = await ingestActivityStart(ctx.client, row.id);

  expect(outcome.outcome).toBe('rejected');

  const stored = await readActivityStart(row.id);

  expect(stored).toBeUndefined();
});

test('it defers a build-snapshot-mismatch while the named predecessor is still active server-side', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);
  const predecessor = await db.activityCollection.create({ avatarID: viewer.avatar.id });

  const row = createMockActivityData({
    avatarID: viewer.avatar.id,
    id: 'act_ingest_server_behind',
    predecessorActivityID: predecessor.id,
    startKey: 'start_key_f',
  });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CHECKPOINT_INVALID({
        data: {
          activityID: row.id,
          appendedHead: 0,
          avatarID: row.avatarID,
          reason: 'build-snapshot-mismatch',
        },
      });
    }),
  );

  await writeActivityStart(row);

  const outcome = await ingestActivityStart(client, row.id);

  expect(outcome).toStrictEqual({
    outcome: 'deferred',
    refusal: { code: 'CHECKPOINT_INVALID', reason: 'build-snapshot-mismatch' },
  });

  const stored = await readActivityStart(row.id);

  expect(stored).toStrictEqual(row);
});

test('it defers a build-snapshot-mismatch while the named predecessor still waits in this device’s store', async () => {
  const ctx = setupTest();
  const track = mock<() => void>();

  const predecessor = createMockActivityData({
    id: 'act_ingest_pending_pred',
    startKey: 'start_key_pending_pred',
  });

  const row = createMockActivityData({
    id: 'act_ingest_pending_next',
    predecessorActivityID: predecessor.id,
    startKey: 'start_key_pending_next',
  });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CHECKPOINT_INVALID({
        data: {
          activityID: row.id,
          appendedHead: 0,
          avatarID: row.avatarID,
          reason: 'build-snapshot-mismatch',
        },
      });
    }),
    mockActivityService.getLatestActivityProgress.handler((opts) => {
      track();
      throw opts.errors.NOT_FOUND({ data: {} });
    }),
  );

  await writeActivityStart(predecessor);
  await writeActivityStart(row);

  const outcome = await ingestActivityStart(ctx.client, row.id);

  expect(outcome).toStrictEqual({
    outcome: 'deferred',
    refusal: { code: 'CHECKPOINT_INVALID', reason: 'build-snapshot-mismatch' },
  });

  expect(track).not.toHaveBeenCalled();

  const stored = await readActivityStart(row.id);

  expect(stored).toStrictEqual(row);
});

test('it rejects a build-snapshot-mismatch once the named predecessor has stopped server-side, carrying the server’s latest row and keeping the row for the drop', async () => {
  const viewer = await createViewer({ avatar: { level: 2, xp: 105 } });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const predecessor = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'stopped',
  });

  const row = createMockActivityData({
    avatarID: viewer.avatar.id,
    id: 'act_ingest_snapshot_wrong',
    predecessorActivityID: predecessor.id,
    startKey: 'start_key_g',
  });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CHECKPOINT_INVALID({
        data: {
          activityID: row.id,
          appendedHead: 0,
          avatarID: row.avatarID,
          reason: 'build-snapshot-mismatch',
        },
      });
    }),
  );

  await writeActivityStart(row);

  const outcome = await ingestActivityStart(client, row.id);

  expect(outcome).toMatchObject({
    outcome: 'rejected',
    refusedSnapshot: {
      latest: {
        activity: { id: predecessor.id, status: 'stopped' },
        optimisticBuild: { level: 2, xp: 105 },
      },
      row,
    },
  });

  const stored = await readActivityStart(row.id);

  expect(stored).toStrictEqual(row);
});

test('it rejects a build-snapshot-mismatch when the server’s active row is not the named predecessor, keeping the row for the drop', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const predecessor = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    startedAt: new Date(Date.now() - 60_000),
  });

  await db.activityCollection.create({ avatarID: viewer.avatar.id, startedAt: new Date() });

  const row = createMockActivityData({
    avatarID: viewer.avatar.id,
    id: 'act_ingest_divergent',
    predecessorActivityID: predecessor.id,
    startKey: 'start_key_divergent',
  });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CHECKPOINT_INVALID({
        data: {
          activityID: row.id,
          appendedHead: 0,
          avatarID: row.avatarID,
          reason: 'build-snapshot-mismatch',
        },
      });
    }),
  );

  await writeActivityStart(row);

  const outcome = await ingestActivityStart(client, row.id);

  expect(outcome.outcome).toBe('rejected');

  const stored = await readActivityStart(row.id);

  expect(stored).toStrictEqual(row);
});

test('it rejects a build-snapshot-mismatch on a start that names no predecessor, keeping the row for the drop', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  await db.activityCollection.create({ avatarID: viewer.avatar.id });

  const row = createMockActivityData({
    avatarID: viewer.avatar.id,
    id: 'act_ingest_no_predecessor',
    predecessorActivityID: null,
    startKey: 'start_key_h',
  });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CHECKPOINT_INVALID({
        data: {
          activityID: row.id,
          appendedHead: 0,
          avatarID: row.avatarID,
          reason: 'build-snapshot-mismatch',
        },
      });
    }),
  );

  await writeActivityStart(row);

  const outcome = await ingestActivityStart(client, row.id);

  expect(outcome.outcome).toBe('rejected');

  const stored = await readActivityStart(row.id);

  expect(stored).toStrictEqual(row);
});

test('it rejects a build-snapshot-mismatch with no server row to fold from when the avatar has no activity', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const row = createMockActivityData({
    avatarID: viewer.avatar.id,
    id: 'act_ingest_no_server_row',
    predecessorActivityID: 'act_ingest_never_landed',
    startKey: 'start_key_i2',
  });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CHECKPOINT_INVALID({
        data: {
          activityID: row.id,
          appendedHead: 0,
          avatarID: row.avatarID,
          reason: 'build-snapshot-mismatch',
        },
      });
    }),
  );

  await writeActivityStart(row);

  const outcome = await ingestActivityStart(client, row.id);

  expect(outcome).toStrictEqual({
    outcome: 'rejected',
    refusal: { code: 'CHECKPOINT_INVALID', reason: 'build-snapshot-mismatch' },
    refusedSnapshot: { latest: null, row },
  });
});

test('it keeps a build-snapshot-mismatch for the backoff when the progress read fails in transport', async () => {
  const ctx = setupTest();

  const row = createMockActivityData({
    id: 'act_ingest_progress_down',
    predecessorActivityID: 'act_ingest_progress_pred',
    startKey: 'start_key_j',
  });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CHECKPOINT_INVALID({
        data: {
          activityID: row.id,
          appendedHead: 0,
          avatarID: row.avatarID,
          reason: 'build-snapshot-mismatch',
        },
      });
    }),
    mockActivityService.getLatestActivityProgress.handler(() => HttpResponse.error()),
  );

  await writeActivityStart(row);

  const outcome = await ingestActivityStart(ctx.client, row.id);

  expect(outcome).toStrictEqual({
    outcome: 'deferred',
    refusal: { code: 'CHECKPOINT_INVALID', reason: 'build-snapshot-mismatch' },
  });

  const stored = await readActivityStart(row.id);

  expect(stored).toStrictEqual(row);
});

test('it defers an activityStart the account switched away from, carrying the switch notice', async () => {
  const ctx = setupTest();

  const row = createMockActivityData({
    id: 'act_ingest_switched',
    startKey: 'start_key_switched',
  });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.AVATAR_NOT_ACTIVE({
        data: { activeAvatarID: 'avatar_other', activeAvatarName: 'Zetha' },
      });
    }),
  );

  await writeActivityStart(row);

  const outcome = await ingestActivityStart(ctx.client, row.id);

  expect(outcome).toStrictEqual({
    notice: { activeAvatarName: 'Zetha', kind: 'avatar-switched' },
    outcome: 'deferred',
    refusal: { code: 'AVATAR_NOT_ACTIVE', reason: null },
  });

  // held, not dropped: switching back delivers it
  const stored = await readActivityStart(row.id);

  expect(stored).toStrictEqual(row);
});

test('it drops an activityStart this build can no longer replay, carrying the reload notice', async () => {
  const ctx = setupTest();
  const row = createMockActivityData({ id: 'act_ingest_expired', startKey: 'start_key_expired' });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.SIM_VERSION_EXPIRED({ data: { currentSimVersion: 'engine_hash_9' } });
    }),
  );

  await writeActivityStart(row);

  const outcome = await ingestActivityStart(ctx.client, row.id);

  expect(outcome).toStrictEqual({
    notice: { kind: 'sim-version-expired' },
    outcome: 'rejected',
    refusal: { code: 'SIM_VERSION_EXPIRED', reason: null },
  });

  const stored = await readActivityStart(row.id);

  expect(stored).toBeUndefined();
});
