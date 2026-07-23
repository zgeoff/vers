import { expect, test } from 'bun:test';
import { shouldTraceRequest } from './should-trace-request';

test('it excludes the health path from tracing', () => {
  expect(shouldTraceRequest(new Request('http://svc.local/health'))).toBeFalse();
});

test('it traces an rpc path', () => {
  expect(shouldTraceRequest(new Request('http://svc.local/rpc/ping'))).toBeTrue();
});

test('it keys on the path alone, ignoring the query string', () => {
  expect(shouldTraceRequest(new Request('http://svc.local/health?probe=fly'))).toBeFalse();
});

test('it traces a path that merely contains the health segment', () => {
  expect(shouldTraceRequest(new Request('http://svc.local/health/deep'))).toBeTrue();
});
