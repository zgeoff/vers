import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createTestConnection } from '../test-utils/create-test-connection';
import { WorkerMessageType } from '../types';
import { applyEviction } from './apply-eviction';

test('it clears the displaced live simulation and broadcasts the displacement', async () => {
  const connection = createTestConnection();
  const submitter = createStubSubmitter();

  submitter.isEvicted = () => true;

  const context = createStubWorkerContext({ connections: [connection.port], submitter });
  const activity = createMockActivityData();

  context.setActivity(activity);
  context.setSimulation(createSimulation());

  applyEviction(context, activity.id);

  expect(context.getActivity()).toBeNull();
  expect(context.getWriterDisplacedActivityID()).toBe(activity.id);

  await connection.waitForMessages(1);

  expect(connection.received).toStrictEqual([
    { activityID: activity.id, type: WorkerMessageType.WriterDisplaced },
  ]);
});

test('it leaves an unrelated live run untouched while still recording the displacement', () => {
  const submitter = createStubSubmitter();

  submitter.isEvicted = () => true;

  const context = createStubWorkerContext({ submitter });
  const liveActivity = createMockActivityData();

  context.setActivity(liveActivity);

  applyEviction(context, 'some-other-activity');

  expect(context.getActivity()).toStrictEqual(liveActivity);
  expect(context.getWriterDisplacedActivityID()).toBe('some-other-activity');
});

test('it skips entirely once a registration has superseded the eviction', async () => {
  const connection = createTestConnection();
  const context = createStubWorkerContext({ connections: [connection.port] });
  const activity = createMockActivityData();

  context.setActivity(activity);

  applyEviction(context, activity.id);

  expect(context.getActivity()).toStrictEqual(activity);
  expect(context.getWriterDisplacedActivityID()).toBeNull();

  // posted on the worker's own port after the call settles, this arrives after anything the call
  // broadcast on the same channel — an empty prefix proves it stayed silent
  connection.port.postMessage({ online: true, type: WorkerMessageType.ConnectionStatus });

  await connection.waitForMessages(1);

  expect(connection.received).toStrictEqual([
    { online: true, type: WorkerMessageType.ConnectionStatus },
  ]);
});
