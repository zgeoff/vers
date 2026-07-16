import { expect, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { makeProductEventSender } from './make-product-event-sender';
import { server } from './mocks/server';
import type { StampedProductEvent } from './types';

const event: StampedProductEvent = {
  name: 'activity_completed',
  properties: { activityID: 'activity-7' },
  sessionID: 'session-7',
  timestamp: new Date('2026-07-16T10:11:12.131Z'),
  userID: 'user-7',
};

test('it posts the encoded row to the events endpoint with the append token', async () => {
  const received: Array<{ authorization: string | null; body: string; url: string }> = [];

  server.use(
    http.post('https://api.example.tinybird.co/v0/events', async (info) => {
      const body = await info.request.text();

      received.push({
        authorization: info.request.headers.get('authorization'),
        body,
        url: info.request.url,
      });

      return HttpResponse.json({ quarantined_rows: 0, successful_rows: 1 }, { status: 202 });
    }),
  );

  const sendProductEvent = makeProductEventSender({
    url: 'https://api.example.tinybird.co',
    token: 'append-token',
  });

  const delivered = await sendProductEvent(event);

  expect(delivered).toBeTrue();
  expect(received).toHaveLength(1);
  expect(received[0]?.url).toBe('https://api.example.tinybird.co/v0/events?name=product_events');
  expect(received[0]?.authorization).toBe('Bearer append-token');

  expect(JSON.parse(received[0]?.body ?? '')).toStrictEqual({
    activity_id: 'activity-7',
    event_name: 'activity_completed',
    node_id: null,
    session_id: 'session-7',
    timestamp: '2026-07-16T10:11:12.131Z',
    user_id: 'user-7',
  });
});

test('it resolves false when the events endpoint rejects the row', async () => {
  server.use(
    http.post('https://api.example.tinybird.co/v0/events', () =>
      HttpResponse.json({ error: 'invalid token' }, { status: 403 }),
    ),
  );

  const sendProductEvent = makeProductEventSender({
    url: 'https://api.example.tinybird.co',
    token: 'append-token',
  });

  const delivered = await sendProductEvent(event);

  expect(delivered).toBeFalse();
});

test('it resolves false when the events endpoint is unreachable', async () => {
  server.use(http.post('https://api.example.tinybird.co/v0/events', () => HttpResponse.error()));

  const sendProductEvent = makeProductEventSender({
    url: 'https://api.example.tinybird.co',
    token: 'append-token',
  });

  const delivered = await sendProductEvent(event);

  expect(delivered).toBeFalse();
});
