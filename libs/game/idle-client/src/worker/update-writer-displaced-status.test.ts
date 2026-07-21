import { expect, test } from 'bun:test';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createTestConnection } from '../test-utils/create-test-connection';
import { WorkerMessageType } from '../types';
import { updateWriterDisplacedStatus } from './update-writer-displaced-status';

test('it records the displacement and broadcasts it to every connection', async () => {
  const connection = createTestConnection();
  const context = createStubWorkerContext({ connections: [connection.port] });

  updateWriterDisplacedStatus(context, 'activity-1');

  expect(context.getWriterDisplacedActivityID()).toBe('activity-1');

  await connection.waitForMessages(1);

  expect(connection.received).toStrictEqual([
    { activityID: 'activity-1', type: WorkerMessageType.WriterDisplaced },
  ]);
});

test('it broadcasts only on transition, never re-raising an unchanged displacement', async () => {
  const connection = createTestConnection();
  const context = createStubWorkerContext({ connections: [connection.port] });

  updateWriterDisplacedStatus(context, 'activity-1');
  updateWriterDisplacedStatus(context, 'activity-1');
  updateWriterDisplacedStatus(context, null);
  updateWriterDisplacedStatus(context, null);

  await connection.waitForMessages(2);

  expect(connection.received).toStrictEqual([
    { activityID: 'activity-1', type: WorkerMessageType.WriterDisplaced },
    { activityID: null, type: WorkerMessageType.WriterDisplaced },
  ]);
});
