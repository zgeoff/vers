import { expect, test } from 'bun:test';
import { createMockRequestSpan } from '../test-utils/factories/create-mock-request-span';
import { collectFleetRequests } from './collect-fleet-requests';

test('it counts a request once and labels it by its routed span', () => {
  const requests = collectFleetRequests([
    createMockRequestSpan({
      name: 'HTTP POST',
      path: '/api/rpc/activity/advanceActivity',
      traceID: 't1',
    }),
    createMockRequestSpan({
      name: 'POST /api/rpc/activity/advanceActivity',
      path: null,
      traceID: 't1',
    }),
    createMockRequestSpan({ name: 'POST /rpc*', path: '/rpc/advanceActivity', traceID: 't1' }),
  ]);

  expect(requests).toStrictEqual([
    { route: 'POST /api/rpc/activity/advanceActivity', traceID: 't1' },
  ]);
});

test('it drops a trace made only of health checks', () => {
  const requests = collectFleetRequests([
    createMockRequestSpan({ name: 'GET /health', path: null, traceID: 't1' }),
    createMockRequestSpan({ name: 'HTTP GET', path: '/health', traceID: 't1' }),
  ]);

  expect(requests).toBeEmpty();
});

test('it drops the anonymous current-user probe that answers 401', () => {
  const requests = collectFleetRequests([
    createMockRequestSpan({
      name: 'POST /api/rpc/user/getCurrentUser',
      path: null,
      statusCode: 401,
      traceID: 't1',
    }),
    createMockRequestSpan({
      name: 'HTTP POST',
      path: '/api/rpc/user/getCurrentUser',
      statusCode: null,
      traceID: 't1',
    }),
    createMockRequestSpan({
      name: 'POST /rpc*',
      path: '/rpc/getUser',
      statusCode: 401,
      traceID: 't1',
    }),
  ]);

  expect(requests).toBeEmpty();
});

test('it keeps a signed-in current-user call', () => {
  const requests = collectFleetRequests([
    createMockRequestSpan({
      name: 'POST /api/rpc/user/getCurrentUser',
      path: null,
      statusCode: 200,
      traceID: 't1',
    }),
  ]);

  expect(requests).toStrictEqual([{ route: 'POST /api/rpc/user/getCurrentUser', traceID: 't1' }]);
});

test('it labels a trace with no routed span by service and path', () => {
  const requests = collectFleetRequests([
    createMockRequestSpan({
      name: 'POST /rpc*',
      path: '/rpc/getSession',
      service: 'service-session',
      traceID: 't1',
    }),
  ]);

  expect(requests).toStrictEqual([{ route: 'service-session /rpc/getSession', traceID: 't1' }]);
});

test('it labels a trace with neither a routed span nor a path by service and name', () => {
  const requests = collectFleetRequests([
    createMockRequestSpan({ name: 'HTTP GET', path: null, service: 'app-web', traceID: 't1' }),
  ]);

  expect(requests).toStrictEqual([{ route: 'app-web HTTP GET', traceID: 't1' }]);
});

test('it keeps a request that shares its window with health checks', () => {
  const requests = collectFleetRequests([
    createMockRequestSpan({ name: 'GET /health', path: null, traceID: 'health' }),
    createMockRequestSpan({ name: 'GET /', path: null, traceID: 'page' }),
  ]);

  expect(requests).toStrictEqual([{ route: 'GET /', traceID: 'page' }]);
});
