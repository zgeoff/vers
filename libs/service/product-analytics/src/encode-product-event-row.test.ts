import { expect, test } from 'bun:test';
import { encodeProductEventRow } from './encode-product-event-row';

test('it encodes an activity start with its activity and node columns filled', () => {
  const row = encodeProductEventRow({
    name: 'activity_started',
    properties: { activityID: 'activity-1', nodeID: 'node-3' },
    sessionID: 'session-1',
    timestamp: new Date('2026-07-16T01:02:03.456Z'),
    userID: 'user-1',
  });

  expect(row).toStrictEqual({
    activity_id: 'activity-1',
    event_name: 'activity_started',
    node_id: 'node-3',
    session_id: 'session-1',
    timestamp: '2026-07-16T01:02:03.456Z',
    user_id: 'user-1',
  });
});

test('it encodes a node event with its node column filled and the rest null', () => {
  const row = encodeProductEventRow({
    name: 'node_explored',
    properties: { nodeID: 'node-9' },
    sessionID: 'session-2',
    timestamp: new Date('2026-07-16T04:05:06.789Z'),
    userID: 'user-2',
  });

  expect(row).toStrictEqual({
    activity_id: null,
    event_name: 'node_explored',
    node_id: 'node-9',
    session_id: 'session-2',
    timestamp: '2026-07-16T04:05:06.789Z',
    user_id: 'user-2',
  });
});

test('it encodes a property-free event with every property column null', () => {
  const row = encodeProductEventRow({
    name: 'session_started',
    properties: {},
    sessionID: 'session-3',
    timestamp: new Date('2026-07-16T07:08:09.012Z'),
    userID: 'user-3',
  });

  expect(row).toStrictEqual({
    activity_id: null,
    event_name: 'session_started',
    node_id: null,
    session_id: 'session-3',
    timestamp: '2026-07-16T07:08:09.012Z',
    user_id: 'user-3',
  });
});
