import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { WorkerMessageType } from '../types';
import { applyEviction } from './apply-eviction';

test('it clears the displaced live simulation and broadcasts the displacement', () => {
  const submitter = createStubSubmitter();

  submitter.isEvicted = () => true;

  const context = createStubWorkerContext({ submitter });
  const activity = createMockActivityData();

  context.setActivity(activity);
  context.setSimulation(createSimulation());

  applyEviction(context, activity.id);

  expect(context.getActivity()).toBeNull();
  expect(context.getWriterDisplacedActivityID()).toBe(activity.id);

  expect(context.getBroadcasts()).toStrictEqual([
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

test('it skips entirely once a registration has superseded the eviction', () => {
  const context = createStubWorkerContext();
  const activity = createMockActivityData();

  context.setActivity(activity);

  applyEviction(context, activity.id);

  expect(context.getActivity()).toStrictEqual(activity);
  expect(context.getWriterDisplacedActivityID()).toBeNull();
  expect(context.getBroadcasts()).toStrictEqual([]);
});
