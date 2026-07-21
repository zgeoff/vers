import { expect, test } from 'bun:test';
import { pickTransportKind } from './pick-transport-kind';

test('it picks the SharedWorker transport whenever the browser has one', () => {
  expect(pickTransportKind({ hasSharedWorker: true, hasWebLocks: true })).toBe('shared-worker');
  expect(pickTransportKind({ hasSharedWorker: true, hasWebLocks: false })).toBe('shared-worker');
});

test('it falls back to Web Locks election without SharedWorker', () => {
  expect(pickTransportKind({ hasSharedWorker: false, hasWebLocks: true })).toBe('web-locks');
});

test('it reports no transport when the browser supports neither', () => {
  expect(pickTransportKind({ hasSharedWorker: false, hasWebLocks: false })).toBe('none');
});
