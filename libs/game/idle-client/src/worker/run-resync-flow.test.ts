import { expect, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/browser';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { server } from '../mocks/node';
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
    status: {
      activeAvatarName: viewer.avatar.name,
      attempts: 0,
      kind: 'avatar-switched',
      levelUps: 0,
    },
    type: WorkerMessageType.ResyncStatus,
  });

  expect(recorded).toStrictEqual([]);
});

test('it clears the stamped resync avatar when the flow ends on avatar-switched with no fallback', async () => {
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

  expect(context.getResyncAvatarID()).toBeNull();
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

test('it broadcasts avatar-switched from a blocked intent retry rather than dropping it silently', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client, submitter: createStubSubmitter() });

  const source = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'active',
  });

  await writePendingStartIntent({
    activityID: source.id,
    avatarID: viewer.avatar.id,
    scopeID: source.scopeID,
    scopeType: source.scopeType,
  });

  // The entry delivery finds the source row still active — genuinely blocked, since its terminal
  // append hasn't landed yet — and the retry after the pass finds the account has since switched
  // avatars.
  let deliveryAttempts = 0;

  server.use(
    mockActivityService.startActivity.handler((opts) => {
      deliveryAttempts += 1;

      if (deliveryAttempts === 1) {
        throw opts.errors.CONFLICT({ data: { activity: source } });
      }

      throw opts.errors.AVATAR_NOT_ACTIVE({
        data: { activeAvatarID: 'avatar_active', activeAvatarName: 'Active One' },
      });
    }),
  );

  const signals: FlowSignals = {
    cancel: context.getCancelSignal(),
    stop: context.getStopSignal(),
  };

  await runResyncFlow(context, viewer.avatar.id, false, signals);

  expect(context.getBroadcasts()).toPartiallyContain({
    status: { activeAvatarName: 'Active One', attempts: 0, kind: 'avatar-switched', levelUps: 0 },
    type: WorkerMessageType.ResyncStatus,
  });

  expect(context.getResyncAvatarID()).toBeNull();
});
