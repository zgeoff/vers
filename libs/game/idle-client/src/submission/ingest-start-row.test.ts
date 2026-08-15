import { expect, mock, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { resolveServiceURL } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import { HttpResponse } from 'msw';
import { server } from '../mocks/node';
import { ingestStartRow } from './ingest-start-row';
import { readStartRow } from './read-start-row';
import type { ActivityServiceClient } from './types';
import { writeStartRow } from './write-start-row';

function setupTest() {
  const link = new RPCLink({ url: `${resolveServiceURL('activity')}/rpc` });

  const client: ActivityServiceClient = createORPCClient(link);

  return { client };
}

test('it ingests a pending root and removes its durable row', async () => {
  const ctx = setupTest();
  const row = createMockActivityData({ id: 'act_ingest_ok', startKey: 'start_key_ok' });

  server.use(
    mockActivityService.advanceActivity.handler(() => ({ activity: row, appendedHead: 0 })),
  );

  await writeStartRow(row);

  const outcome = await ingestStartRow(ctx.client, row.id);

  expect(outcome).toBe('ingested');

  const stored = await readStartRow(row.id);

  expect(stored).toBeUndefined();
});

test('it reports absent for an activity id this device holds no pending root for', async () => {
  const ctx = setupTest();

  const outcome = await ingestStartRow(ctx.client, 'act_ingest_absent');

  expect(outcome).toBe('absent');
});

test('it defers and keeps the root on a transport failure', async () => {
  const ctx = setupTest();
  const row = createMockActivityData({ id: 'act_ingest_transport', startKey: 'start_key_t' });

  server.use(mockActivityService.advanceActivity.handler(() => HttpResponse.error()));

  await writeStartRow(row);

  const outcome = await ingestStartRow(ctx.client, row.id);

  expect(outcome).toBe('deferred');

  const stored = await readStartRow(row.id);

  expect(stored).toStrictEqual(row);
});

test('it defers and keeps the root when the avatar reads temporarily inactive', async () => {
  const ctx = setupTest();
  const row = createMockActivityData({ id: 'act_ingest_inactive', startKey: 'start_key_i' });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.AVATAR_NOT_ACTIVE({
        data: { activeAvatarID: 'avatar_other', activeAvatarName: 'Other' },
      });
    }),
  );

  await writeStartRow(row);

  const outcome = await ingestStartRow(ctx.client, row.id);

  expect(outcome).toBe('deferred');

  const stored = await readStartRow(row.id);

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

  await writeStartRow(row);

  const outcome = await ingestStartRow(ctx.client, row.id);

  expect(outcome).toBe('rejected');
  expect(track).not.toHaveBeenCalled();

  const stored = await readStartRow(row.id);

  expect(stored).toBeUndefined();
});

test('it rejects and removes the root once the server refuses it with CONFLICT', async () => {
  const ctx = setupTest();
  const row = createMockActivityData({ id: 'act_ingest_conflict', startKey: 'start_key_c' });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CONFLICT({ data: { activityID: row.id, appendedHead: 3 } });
    }),
  );

  await writeStartRow(row);

  const outcome = await ingestStartRow(ctx.client, row.id);

  expect(outcome).toBe('rejected');

  const stored = await readStartRow(row.id);

  expect(stored).toBeUndefined();
});
