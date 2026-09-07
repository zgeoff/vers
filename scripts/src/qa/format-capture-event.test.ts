import { expect, test } from 'bun:test';
import { formatCaptureEvent } from './format-capture-event';

test('it prints a request with its body on the next line', () => {
  const line = formatCaptureEvent({
    body: '{"json":{"activityID":"a1"}}',
    kind: 'request',
    method: 'POST',
    url: 'https://versidle.com/api/rpc/activity/startActivity',
  });

  expect(line).toBe(
    '>> POST https://versidle.com/api/rpc/activity/startActivity\n   body: {"json":{"activityID":"a1"}}',
  );
});

test('it prints the status of a response and the body once it is read', () => {
  expect(
    formatCaptureEvent({
      kind: 'response',
      status: 200,
      url: 'https://versidle.com/api/rpc/activity/startActivity',
    }),
  ).toBe('<< 200 https://versidle.com/api/rpc/activity/startActivity');

  expect(
    formatCaptureEvent({
      body: '{"json":{"id":"a1"}}',
      kind: 'body',
      url: 'https://versidle.com/api/rpc/activity/startActivity',
    }),
  ).toBe('   response https://versidle.com/api/rpc/activity/startActivity: {"json":{"id":"a1"}}');
});

test('it cuts a body past 1500 characters and marks the cut', () => {
  const line = formatCaptureEvent({
    body: 'x'.repeat(1600),
    kind: 'body',
    url: 'https://versidle.com/api/rpc/activity/getActivityRewards',
  });

  expect(line).toEndWith(`${'x'.repeat(1500)}…`);
  expect(line).not.toInclude('x'.repeat(1501));
});

test('it prints a failed request, an attachment, and a detachment on one line each', () => {
  expect(
    formatCaptureEvent({
      kind: 'failure',
      reason: 'net::ERR_INTERNET_DISCONNECTED',
      url: 'https://versidle.com/api/rpc/activity/startActivity',
    }),
  ).toBe(
    '!! failed https://versidle.com/api/rpc/activity/startActivity: net::ERR_INTERNET_DISCONNECTED',
  );

  expect(formatCaptureEvent({ kind: 'attached', targetID: 'W1' })).toBe('attached worker W1');
  expect(formatCaptureEvent({ kind: 'detached', targetID: 'W1' })).toBe('worker W1 closed');
});
