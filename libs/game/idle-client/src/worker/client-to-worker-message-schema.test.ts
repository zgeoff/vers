import { expect, test } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import { ClientMessageType } from '../types';
import { clientToWorkerMessageSchema } from './client-to-worker-message-schema';

test('it accepts a well-formed disconnect message', () => {
  const message = { type: ClientMessageType.Disconnect };

  expect(clientToWorkerMessageSchema.safeParse(message)).toMatchObject({
    data: message,
    success: true,
  });
});

test('it accepts a well-formed initialize message', () => {
  const message = { type: ClientMessageType.Initialize };

  expect(clientToWorkerMessageSchema.safeParse(message)).toMatchObject({
    data: message,
    success: true,
  });
});

test('it accepts a well-formed report-online message', () => {
  const message = { avatarID: 'avatar_1', claim: true, type: ClientMessageType.ReportOnline };

  expect(clientToWorkerMessageSchema.safeParse(message)).toMatchObject({
    data: message,
    success: true,
  });
});

test('it accepts a well-formed set-failure-action message', () => {
  const message = {
    avatarID: 'avatar_1',
    failureAction: ActivityFailureAction.Retry,
    type: ClientMessageType.SetFailureAction,
  };

  expect(clientToWorkerMessageSchema.safeParse(message)).toMatchObject({
    data: message,
    success: true,
  });
});

test('it accepts a well-formed start-activity message', () => {
  const message = {
    avatarID: 'avatar_1',
    requestID: 'request_1',
    scopeID: 'node_1',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  };

  expect(clientToWorkerMessageSchema.safeParse(message)).toMatchObject({
    data: message,
    success: true,
  });
});

test('it accepts a well-formed stop-activity message', () => {
  const message = {
    activityID: 'activity_1',
    avatarID: 'avatar_1',
    type: ClientMessageType.StopActivity,
  };

  expect(clientToWorkerMessageSchema.safeParse(message)).toMatchObject({
    data: message,
    success: true,
  });
});

test('it rejects a message with an undeclared discriminant', () => {
  const result = clientToWorkerMessageSchema.safeParse({ type: 'set_activity' });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['type'] }));
});

test('it rejects a start-activity message missing a required field', () => {
  const result = clientToWorkerMessageSchema.safeParse({
    avatarID: 'avatar_1',
    requestID: 'request_1',
    scopeType: 'world_map_node',
    type: ClientMessageType.StartActivity,
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['scopeID'] }));
});
