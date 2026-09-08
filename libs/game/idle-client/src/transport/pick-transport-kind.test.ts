import { expect, test } from 'bun:test';
import { pickTransportKind } from './pick-transport-kind';

test('it picks the SharedWorker transport when the browser has one beside Web Locks', () => {
  expect(pickTransportKind({ hasSharedWorker: true, hasWebLocks: true })).toBe('shared-worker');
});

test('it falls back to Web Locks election without SharedWorker', () => {
  expect(pickTransportKind({ hasSharedWorker: false, hasWebLocks: true })).toBe('web-locks');
});

test('it reports no transport without Web Locks, SharedWorker or not', () => {
  expect(pickTransportKind({ hasSharedWorker: true, hasWebLocks: false })).toBe('none');
  expect(pickTransportKind({ hasSharedWorker: false, hasWebLocks: false })).toBe('none');
});
