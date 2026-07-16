import { expect, test } from 'bun:test';
import { productEventSchema } from './product-event-schema';

test('it accepts an activity started event with its activity and node', () => {
  const result = productEventSchema.safeParse({
    name: 'activity_started',
    properties: { activityID: 'activity-1', nodeID: 'node-1' },
  });

  expect(result.success).toBeTrue();

  expect(result.data).toStrictEqual({
    name: 'activity_started',
    properties: { activityID: 'activity-1', nodeID: 'node-1' },
  });
});

test('it accepts a session started event with empty properties', () => {
  const result = productEventSchema.safeParse({ name: 'session_started', properties: {} });

  expect(result.success).toBeTrue();
  expect(result.data).toStrictEqual({ name: 'session_started', properties: {} });
});

test('it rejects an unregistered event name', () => {
  const result = productEventSchema.safeParse({
    name: 'password_typed',
    properties: {},
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues[0]?.path).toStrictEqual(['name']);
});

test('it rejects an activity completed event missing its activity', () => {
  const result = productEventSchema.safeParse({
    name: 'activity_completed',
    properties: {},
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues[0]?.path).toStrictEqual(['properties', 'activityID']);
});

test('it strips identity keys a client smuggles into properties', () => {
  const result = productEventSchema.safeParse({
    name: 'node_explored',
    properties: { nodeID: 'node-1', userID: 'someone-else' },
  });

  expect(result.success).toBeTrue();
  expect(result.data).toStrictEqual({ name: 'node_explored', properties: { nodeID: 'node-1' } });
});
