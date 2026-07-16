import { expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { server } from '../../mocks/node';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { runProductEventIngest } from './run-product-event-ingest';

test('it stamps the acting session onto the event and delivers it', async () => {
  const received: Array<string> = [];

  server.use(
    http.post('https://tinybird.test/v0/events', async (info) => {
      const body = await info.request.text();

      received.push(body);

      return HttpResponse.json({ quarantined_rows: 0, successful_rows: 1 }, { status: 202 });
    }),
  );

  const signedIn = await createSignedInUser();

  await withRequestContext({ cookies: signedIn.cookies }, () =>
    runProductEventIngest({
      name: 'activity_started',
      properties: { activityID: 'activity-1', nodeID: 'node-1' },
    }),
  );

  expect(received).toHaveLength(1);

  expect(JSON.parse(received[0] ?? '')).toStrictEqual({
    activity_id: 'activity-1',
    event_name: 'activity_started',
    node_id: 'node-1',
    session_id: signedIn.sessionID,
    timestamp: expect.toBeDateString(),
    user_id: signedIn.userID,
  });
});

test('it drops an unauthenticated caller’s event without contacting analytics', async () => {
  const received: Array<string> = [];

  server.use(
    http.post('https://tinybird.test/v0/events', async (info) => {
      const body = await info.request.text();

      received.push(body);

      return HttpResponse.json({ quarantined_rows: 0, successful_rows: 1 }, { status: 202 });
    }),
  );

  await withRequestContext({}, () =>
    runProductEventIngest({ name: 'session_started', properties: {} }),
  );

  expect(received).toStrictEqual([]);
});
