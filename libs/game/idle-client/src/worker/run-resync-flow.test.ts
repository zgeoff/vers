import { expect, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/browser';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import * as db from '@vers/mock-services/db';
import { readPendingStartIntent } from '../submission/read-pending-start-intent';
import type { ActivityServiceClient } from '../submission/types';
import { writePendingStartIntent } from '../submission/write-pending-start-intent';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { WorkerMessageType } from '../types';
import { runResyncFlow } from './run-resync-flow';
import { sentryHandle } from './sentry-handle';
import { startErrorReporting } from './start-error-reporting';
import type { FlowSignals } from './types';

test('it resets a held run belonging to another avatar before installing', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client });

  // a run held for a different avatar can only arrive through the switch guard's TOCTOU gap
  context.setActivity(createMockActivityData({ avatarID: 'someone-else' }));

  const before = context.getSimulation();

  const signals: FlowSignals = {
    cancel: context.getCancelSignal(),
    stop: context.getStopSignal(),
  };

  await runResyncFlow(context, viewer.avatar.id, false, signals);

  expect(context.getActivity()).toBeNull();
  expect(context.getSimulation()).not.toBe(before);
});

test('it broadcasts avatar-switched, and reports no worker fault, when the held intent avatar is no longer active', async () => {
  const previousHandle = sentryHandle.current;
  const recorded: Array<Readonly<ErrorEvent>> = [];

  onTestFinished(() => {
    sentryHandle.current = previousHandle;
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  const viewer = await createViewer();
  const otherAvatar = await db.avatarCollection.create({ userID: viewer.user.id });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client, submitter: createStubSubmitter() });

  const source = await db.activityCollection.create({
    avatarID: otherAvatar.id,
    status: 'stopped',
  });

  await writePendingStartIntent({
    activityID: source.id,
    avatarID: otherAvatar.id,
    scopeID: source.scopeID,
    scopeType: source.scopeType,
  });

  const signals: FlowSignals = {
    cancel: context.getCancelSignal(),
    stop: context.getStopSignal(),
  };

  await runResyncFlow(context, otherAvatar.id, false, signals);

  expect(context.getBroadcasts()).toPartiallyContain({
    status: { activeAvatarName: viewer.avatar.name, kind: 'avatar-switched' },
    type: WorkerMessageType.ResyncStatus,
  });

  expect(recorded).toStrictEqual([]);
});

test('it runs the pass for the signalled avatar after dropping an inactive avatar intent', async () => {
  const viewer = await createViewer();
  const otherAvatar = await db.avatarCollection.create({ userID: viewer.user.id });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client, submitter: createStubSubmitter() });

  const source = await db.activityCollection.create({
    avatarID: otherAvatar.id,
    status: 'stopped',
  });

  await writePendingStartIntent({
    activityID: source.id,
    avatarID: otherAvatar.id,
    scopeID: source.scopeID,
    scopeType: source.scopeType,
  });

  await db.activityCollection.create({
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    status: 'capped',
  });

  const signals: FlowSignals = {
    cancel: context.getCancelSignal(),
    stop: context.getStopSignal(),
  };

  await runResyncFlow(context, otherAvatar.id, false, signals, viewer.avatar.id);

  expect(context.getBroadcasts()).toPartiallyContain({
    status: { kind: 'capped' },
    type: WorkerMessageType.ResyncStatus,
  });

  expect(context.getResyncAvatarID()).toBe(viewer.avatar.id);

  const heldIntent = await readPendingStartIntent();

  expect(heldIntent).toBeUndefined();
});
