import { expect, mock, onTestFinished, test } from 'bun:test';
import { sendAnalyticsEvent } from './send-analytics-event';

test('it forwards the event to the tracker on the page', () => {
  const track = mock(() => {});

  Object.defineProperty(globalThis, 'umami', { configurable: true, value: { track } });

  onTestFinished(() => {
    Reflect.deleteProperty(globalThis, 'umami');
  });

  sendAnalyticsEvent('signup-complete');

  expect(track).toHaveBeenCalledExactlyOnceWith('signup-complete');
});

test('it no-ops without a tracker on the page', () => {
  expect(() => {
    sendAnalyticsEvent('avatar-created');
  }).not.toThrow();
});
