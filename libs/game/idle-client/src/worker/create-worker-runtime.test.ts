import { expect, test } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import { createAuthedServiceClient, createViewer, resolveServiceURL } from '@vers/mock-services';
import * as db from '@vers/mock-services/db';
import { waitFor } from '@vers/test-utils';
import { http } from 'msw';
import invariant from 'tiny-invariant';
import { server } from '../mocks/node';
import type { ActivityServiceClient } from '../submission/types';
import { writeFailureActionCache } from '../submission/write-failure-action-cache';
import { writePendingStartIntent } from '../submission/write-pending-start-intent';
import { createFastClock } from '../test-utils/create-fast-clock';
import type { TestConnection } from '../test-utils/create-test-connection';
import { createTestConnection } from '../test-utils/create-test-connection';
import { makeFailFirstMatchHandler } from '../test-utils/make-fail-first-match-handler';
import { ClientMessageType, WorkerMessageType } from '../types';
import { createWorkerRuntime } from './create-worker-runtime';
import type { WorkerRuntime } from './create-worker-runtime';

function createConnection(runtime: WorkerRuntime): TestConnection {
  const connection = createTestConnection();

  runtime.handleConnect(new MessageEvent('connect', { ports: [connection.port] }));

  return connection;
}

test('it replies with the initial state to an initialize message', async () => {
  using runtime = createWorkerRuntime();

  const connection = createConnection(runtime);

  connection.post({ type: ClientMessageType.Initialize });

  await connection.waitForMessages(1);

  expect(connection.received[0]?.type).toBe(WorkerMessageType.InitialState);
});

test('it seeds the boot state from the device-local failure-action cache before the first message runs', async () => {
  await writeFailureActionCache({
    avatarID: 'seeded-avatar',
    dirty: true,
    failureAction: ActivityFailureAction.Retry,
  });

  using runtime = createWorkerRuntime();

  const connection = createConnection(runtime);

  connection.post({ type: ClientMessageType.Initialize });

  await connection.waitForMessages(2);

  expect(connection.received[1]).toStrictEqual({
    failureAction: ActivityFailureAction.Retry,
    type: WorkerMessageType.FailureActionStatus,
  });
});

test('it retains the cached dirty flag across boot so the next resync flushes it to the server', async () => {
  const viewer = await createViewer();

  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    startedAt: new Date(),
  });

  await writeFailureActionCache({
    avatarID: viewer.avatar.id,
    dirty: true,
    failureAction: ActivityFailureAction.Retry,
  });

  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  using runtime = createWorkerRuntime({ client });

  const connection = createConnection(runtime);

  connection.post({
    avatarID: viewer.avatar.id,
    claim: false,
    type: ClientMessageType.RequestResync,
  });

  await waitFor(() => {
    const updatedAvatar = db.avatarCollection.findFirst((q) => q.where({ id: viewer.avatar.id }));

    expect(updatedAvatar?.failureAction).toBe('retry');
  });
});

test('it broadcasts a simulation update once a started run installs', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  using runtime = createWorkerRuntime({ client });

  const connection = createConnection(runtime);

  connection.post({ type: ClientMessageType.Initialize });

  await connection.waitForMessages(2);

  connection.post({
    avatarID: viewer.avatar.id,
    requestID: 'start_1',
    scopeID: 'esaxrt',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  });

  await waitFor(() => {
    expect(connection.received).toPartiallyContain({
      type: WorkerMessageType.SimulationUpdate,
    });
  });
});

test('it stops broadcasting to a connection after it disconnects', async () => {
  using runtime = createWorkerRuntime();

  const survivor = createConnection(runtime);
  const leaving = createConnection(runtime);

  survivor.post({ type: ClientMessageType.Initialize });

  await survivor.waitForMessages(2);

  expect(runtime.connections.size).toBe(2);

  const leavingReceivedCount = leaving.received.length;

  leaving.post({ type: ClientMessageType.Disconnect });

  await waitFor(() => {
    expect(runtime.connections.size).toBe(1);
  });

  survivor.post({
    avatarID: 'avatar_1',
    failureAction: ActivityFailureAction.Retry,
    type: ClientMessageType.SetFailureAction,
  });

  await waitFor(() => {
    expect(survivor.received).toPartiallyContain({
      failureAction: ActivityFailureAction.Retry,
      type: WorkerMessageType.FailureActionStatus,
    });
  });

  expect(leaving.received).toHaveLength(leavingReceivedCount);
});

test('it resumes into a fresh row once a same-row CONFLICT resync drains a held terminal append', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  // this seed's placeholder encounter completes in exactly 60s of simulated time; the fast clock
  // below collapses that wait into a single tick-loop frame. A zero-gap active row makes the
  // resync below attach it live — the tab-side install path now that only the worker sets
  // activities.
  const activity = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    encounterNode: { difficulty: 1 },
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startedAt: new Date(),
  });

  // holds this activity's terminal append once: the row it closes stays active server-side, so
  // the continuation's own startActivity call races back a same-row CONFLICT
  server.use(
    http.post(
      `${resolveServiceURL('activity')}/rpc/trackActivityProgress`,
      makeFailFirstMatchHandler((input) => input['activityID'] === activity.id),
    ),
  );

  const clock = createFastClock();

  using runtime = createWorkerRuntime({ client, now: clock.now });

  const connection = createConnection(runtime);

  connection.post({ type: ClientMessageType.Initialize });

  await connection.waitForMessages(1);

  connection.post({
    avatarID: viewer.avatar.id,
    claim: false,
    type: ClientMessageType.RequestResync,
  });

  await waitFor(
    () => {
      // re-armed every poll: a jump that lands before the tick loop installs the simulation is an
      // idle frame, so the wait just re-arms the next one until it lands on a live tick
      clock.jump(65_000);

      const minted = db.activityCollection.findFirst((q) =>
        q.where({ avatarID: viewer.avatar.id, status: 'active' }),
      );

      invariant(minted !== undefined, 'expected the same-row CONFLICT resync to mint a fresh row');
      expect(minted.id).not.toBe(activity.id);
    },

    // the tick loop paces itself on real timers between each of the many timesteps this jump
    // spans, so a loaded runner can need several times the default budget to land a live tick
    { timeoutMs: 5000 },
  );

  const closed = db.activityCollection.findFirst((q) => q.where({ id: activity.id }));

  invariant(closed !== undefined, 'expected the seeded activity to still exist');
  expect(closed.status).toBe('stopped');
});

test('it resumes into a fresh row once a reconnect drains a held terminal append behind an offline continuation', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  // this seed's placeholder encounter completes in exactly 60s of simulated time; the fast clock
  // below collapses that wait into a single tick-loop frame. A zero-gap active row makes the
  // resync below attach it live — the tab-side install path now that only the worker sets
  // activities.
  const activity = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    encounterNode: { difficulty: 1 },
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startedAt: new Date(),
  });

  // both this activity's terminal append and its continuation's own startActivity call fail once,
  // standing in for the device going offline right as the run completes
  server.use(
    http.post(
      `${resolveServiceURL('activity')}/rpc/trackActivityProgress`,
      makeFailFirstMatchHandler((input) => input['activityID'] === activity.id),
    ),
    http.post(
      `${resolveServiceURL('activity')}/rpc/startActivity`,
      makeFailFirstMatchHandler((input) => input['avatarID'] === viewer.avatar.id),
    ),
  );

  const clock = createFastClock();

  using runtime = createWorkerRuntime({ client, now: clock.now });

  const connection = createConnection(runtime);

  connection.post({ type: ClientMessageType.Initialize });

  await connection.waitForMessages(1);

  connection.post({
    avatarID: viewer.avatar.id,
    claim: false,
    type: ClientMessageType.RequestResync,
  });

  await waitFor(
    () => {
      // re-armed every poll: a jump that lands before the tick loop installs the simulation is an
      // idle frame, so the wait just re-arms the next one until it lands on a live tick
      clock.jump(65_000);

      expect(connection.received).toPartiallyContain({
        online: false,
        type: WorkerMessageType.ConnectionStatus,
      });
    },

    // the tick loop paces itself on real timers between each of the many timesteps this jump
    // spans, so a loaded runner can need several times the default budget to land a live tick
    { timeoutMs: 5000 },
  );

  globalThis.dispatchEvent(new Event('online'));

  await waitFor(() => {
    const minted = db.activityCollection.findFirst((q) =>
      q.where({ avatarID: viewer.avatar.id, status: 'active' }),
    );

    invariant(minted !== undefined, 'expected the reconnect resync to mint a fresh row');
    expect(minted.id).not.toBe(activity.id);
  });

  const closed = db.activityCollection.findFirst((q) => q.where({ id: activity.id }));

  invariant(closed !== undefined, 'expected the seeded activity to still exist');
  expect(closed.status).toBe('stopped');
});

test("it resumes the held start intent's avatar on reconnect over an earlier avatar it resynced", async () => {
  const viewer = await createViewer();
  const avatar = await db.avatarCollection.create({ userID: viewer.user.id });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  // the intent's source row already reads closed, so the reconnect's drain mints the next row
  const source = await db.activityCollection.create({
    avatarID: avatar.id,
    status: 'stopped',
  });

  await writePendingStartIntent({
    activityID: source.id,
    avatarID: avatar.id,
    scopeID: source.scopeID,
    scopeType: source.scopeType,
  });

  // a capped row makes the first resync's completion observable: it plans a rebase and emits a
  // capped status, installing nothing — the reconnect gate below still sees no simulation
  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'capped',
  });

  using runtime = createWorkerRuntime({ client });

  const connection = createConnection(runtime);

  // the worker remembers this avatar as its last resync target; the held intent must outrank
  // that memory on reconnect or the continuation strands. The drain leaves the intent alone
  // here — it belongs to the other avatar.
  connection.post({
    avatarID: viewer.avatar.id,
    claim: false,
    type: ClientMessageType.RequestResync,
  });

  await waitFor(() => {
    expect(connection.received).toPartiallyContain({
      status: { kind: 'capped' },
      type: WorkerMessageType.ResyncStatus,
    });
  });

  globalThis.dispatchEvent(new Event('online'));

  await waitFor(() => {
    const minted = db.activityCollection.findFirst((q) =>
      q.where({ avatarID: avatar.id, status: 'active' }),
    );

    invariant(minted !== undefined, 'expected the reconnect to resume the pending avatar');
    expect(minted.id).not.toBe(source.id);
  });
});
