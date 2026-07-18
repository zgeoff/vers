import { expect, mock, test } from 'bun:test';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createTestConnection } from '../test-utils/create-test-connection';
import type { RequestFlushMessage } from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import { handleRequestFlushMessage } from './handle-request-flush-message';

test('it flushes the activity via the submitter and acks with the echoed request id', async () => {
  const flushNow = mock<CheckpointSubmitter['flushNow']>(() => Promise.resolve());

  const submitter: CheckpointSubmitter = {
    flushHeld: () => Promise.resolve(),
    flushNow,
    registerActivity: () => Promise.resolve(),
    submit: () => Promise.resolve(undefined),
  };

  const connection = createTestConnection();
  const context = createStubWorkerContext({ connections: [connection.port], submitter });

  const message: RequestFlushMessage = {
    activityID: 'activity_1',
    requestID: 'request_1',
    type: ClientMessageType.RequestFlush,
  };

  await handleRequestFlushMessage(context, connection.port, message);

  expect(flushNow).toHaveBeenCalledExactlyOnceWith('activity_1');

  await connection.waitForMessages(1);

  expect(connection.received).toStrictEqual([
    { activityID: 'activity_1', requestID: 'request_1', type: WorkerMessageType.FlushCompleted },
  ]);
});

test('it acks only the requesting port, never a bystander connection', async () => {
  const requester = createTestConnection();
  const bystander = createTestConnection();

  const context = createStubWorkerContext({
    connections: [requester.port, bystander.port],
  });

  const message: RequestFlushMessage = {
    activityID: 'activity_1',
    requestID: 'request_1',
    type: ClientMessageType.RequestFlush,
  };

  await handleRequestFlushMessage(context, requester.port, message);

  await requester.waitForMessages(1);

  expect(bystander.received).toStrictEqual([]);
});
