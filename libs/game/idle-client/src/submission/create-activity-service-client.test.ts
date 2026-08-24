import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { HttpResponse, http } from 'msw';
import { server } from '../mocks/node';
import { createActivityServiceClient } from './create-activity-service-client';
import { readAllActivityStarts } from './read-all-activity-starts';
import { writeActivityStart } from './write-activity-start';

test('it discards the undelivered offline work when the proxy reports the session superseded', async () => {
  server.use(
    http.post(`${self.location.origin}/api/rpc/activity/stopActivity`, () =>
      HttpResponse.json(null, { headers: { 'x-session-superseded': '1' }, status: 401 }),
    ),
  );

  await writeActivityStart(createMockActivityData());

  const client = createActivityServiceClient();

  await expect(client.stopActivity({ avatarID: 'avatar-1' })).toReject();

  const remaining = await readAllActivityStarts();

  expect(remaining).toStrictEqual([]);
});

test('it keeps the undelivered offline work when a refusal carries no superseded marker', async () => {
  server.use(
    http.post(`${self.location.origin}/api/rpc/activity/stopActivity`, () =>
      HttpResponse.json(null, { status: 401 }),
    ),
  );

  const start = createMockActivityData();

  await writeActivityStart(start);

  const client = createActivityServiceClient();

  await expect(client.stopActivity({ avatarID: 'avatar-1' })).toReject();

  const remaining = await readAllActivityStarts();

  expect(remaining).toStrictEqual([start]);
});
