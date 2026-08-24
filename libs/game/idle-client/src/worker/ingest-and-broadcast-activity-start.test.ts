import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { mockActivityService } from '@vers/mock-services/activity';
import { server } from '../mocks/node';
import { readActivityStart } from '../submission/read-activity-start';
import { writeActivityStart } from '../submission/write-activity-start';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { WorkerMessageType } from '../types';
import { ingestAndBroadcastActivityStart } from './ingest-and-broadcast-activity-start';

test('it announces an activity start the server takes', async () => {
  const context = createStubWorkerContext();
  const row = createMockActivityData({ id: 'act_ingest_taken', startKey: 'start_key_taken' });

  await writeActivityStart(row);

  server.use(
    mockActivityService.advanceActivity.handler(() => ({ activity: row, appendedHead: 0 })),
  );

  const outcome = await ingestAndBroadcastActivityStart(context, row.id);

  expect(outcome).toBe('ingested');

  expect(context.getBroadcasts()).toStrictEqual([
    { activityID: row.id, type: WorkerMessageType.ActivityStartIngested },
  ]);
});

test('it announces nothing for an activity start the server refuses', async () => {
  const context = createStubWorkerContext();
  const row = createMockActivityData({ id: 'act_ingest_refused', startKey: 'start_key_refused' });

  await writeActivityStart(row);

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.NODE_NOT_REVEALED({ data: {} });
    }),
  );

  const outcome = await ingestAndBroadcastActivityStart(context, row.id);

  expect(outcome).toBe('rejected');
  expect(context.getBroadcasts()).toStrictEqual([]);
});

test('it announces nothing while the server stays unreachable', async () => {
  const context = createStubWorkerContext();
  const row = createMockActivityData({ id: 'act_ingest_held', startKey: 'start_key_held' });

  await writeActivityStart(row);

  server.use(
    mockActivityService.advanceActivity.handler(() => {
      throw new Error('activity backend unreachable');
    }),
  );

  const outcome = await ingestAndBroadcastActivityStart(context, row.id);

  expect(outcome).toBe('deferred');
  expect(context.getBroadcasts()).toStrictEqual([]);
  expect(readActivityStart(row.id)).resolves.toMatchObject({ id: row.id });
});
