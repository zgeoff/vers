import { expect, test } from 'bun:test';
import * as db from '@vers/mock-services/db';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { runProductEventIngest } from './run-product-event-ingest';

test('it stamps the acting session onto the event and delivers it', async () => {
  const signedIn = await createSignedInUser();

  await withRequestContext({ cookies: signedIn.cookies }, () =>
    runProductEventIngest({
      name: 'activity_started',
      properties: { activityID: 'activity-1', nodeID: 'node-1' },
    }),
  );

  const row = db.productEventCollection.findFirst((q) =>
    q.where({ session_id: signedIn.sessionID }),
  );

  expect(row).toMatchObject({
    activity_id: 'activity-1',
    datasource: 'product_events',
    event_name: 'activity_started',
    node_id: 'node-1',
    session_id: signedIn.sessionID,
    timestamp: expect.toBeDateString(),
    user_id: signedIn.userID,
  });
});

test('it drops an unauthenticated caller’s event without contacting analytics', async () => {
  const rowsBefore = db.productEventCollection.findMany((q) =>
    q.where({ event_name: 'session_started' }),
  ).length;

  await withRequestContext({}, () =>
    runProductEventIngest({ name: 'session_started', properties: {} }),
  );

  const rowsAfter = db.productEventCollection.findMany((q) =>
    q.where({ event_name: 'session_started' }),
  ).length;

  expect(rowsAfter).toBe(rowsBefore);
});
