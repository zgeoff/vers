import { expect, test } from 'bun:test';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { WorkerMessageType } from '../types';
import { updateWriterDisplacedStatus } from './update-writer-displaced-status';

test('it records the displacement and broadcasts it to every connection', () => {
  const context = createStubWorkerContext();

  updateWriterDisplacedStatus(context, 'activity-1');

  expect(context.getWriterDisplacedActivityID()).toBe('activity-1');

  expect(context.getBroadcasts()).toStrictEqual([
    { activityID: 'activity-1', type: WorkerMessageType.WriterDisplaced },
  ]);
});

test('it broadcasts only on transition, never re-raising an unchanged displacement', () => {
  const context = createStubWorkerContext();

  updateWriterDisplacedStatus(context, 'activity-1');
  updateWriterDisplacedStatus(context, 'activity-1');
  updateWriterDisplacedStatus(context, null);
  updateWriterDisplacedStatus(context, null);

  expect(context.getBroadcasts()).toStrictEqual([
    { activityID: 'activity-1', type: WorkerMessageType.WriterDisplaced },
    { activityID: null, type: WorkerMessageType.WriterDisplaced },
  ]);
});
