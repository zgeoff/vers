import { expect, test } from 'bun:test';
import { collectFleetRequests } from './collect-fleet-requests';

test('it counts a request once and labels it by its routed span', () => {
  const requests = collectFleetRequests([
    {
      name: 'HTTP POST',
      path: '/api/rpc/activity/advanceActivity',
      service: 'app-web',
      statusCode: null,
      traceID: 't1',
    },
    {
      name: 'POST /api/rpc/activity/advanceActivity',
      path: null,
      service: 'app-web',
      statusCode: 200,
      traceID: 't1',
    },
    {
      name: 'POST /rpc*',
      path: '/rpc/advanceActivity',
      service: 'service-activity',
      statusCode: 200,
      traceID: 't1',
    },
  ]);

  expect(requests).toStrictEqual([
    { route: 'POST /api/rpc/activity/advanceActivity', traceID: 't1' },
  ]);
});

test('it drops a trace made only of health checks', () => {
  const requests = collectFleetRequests([
    { name: 'GET /health', path: null, service: 'app-web', statusCode: 200, traceID: 't1' },
    { name: 'HTTP GET', path: '/health', service: 'app-web', statusCode: null, traceID: 't1' },
  ]);

  expect(requests).toBeEmpty();
});

test('it drops the anonymous current-user probe that answers 401', () => {
  const requests = collectFleetRequests([
    {
      name: 'POST /api/rpc/user/getCurrentUser',
      path: null,
      service: 'app-web',
      statusCode: 401,
      traceID: 't1',
    },
    {
      name: 'HTTP POST',
      path: '/api/rpc/user/getCurrentUser',
      service: 'app-web',
      statusCode: null,
      traceID: 't1',
    },
    {
      name: 'POST /rpc*',
      path: '/rpc/getUser',
      service: 'service-user',
      statusCode: 401,
      traceID: 't1',
    },
  ]);

  expect(requests).toBeEmpty();
});

test('it keeps a signed-in current-user call', () => {
  const requests = collectFleetRequests([
    {
      name: 'POST /api/rpc/user/getCurrentUser',
      path: null,
      service: 'app-web',
      statusCode: 200,
      traceID: 't1',
    },
  ]);

  expect(requests).toStrictEqual([{ route: 'POST /api/rpc/user/getCurrentUser', traceID: 't1' }]);
});

test('it labels a trace with no routed span by service and path', () => {
  const requests = collectFleetRequests([
    {
      name: 'POST /rpc*',
      path: '/rpc/getSession',
      service: 'service-session',
      statusCode: 200,
      traceID: 't1',
    },
  ]);

  expect(requests).toStrictEqual([{ route: 'service-session /rpc/getSession', traceID: 't1' }]);
});

test('it labels a trace with neither a routed span nor a path by service and name', () => {
  const requests = collectFleetRequests([
    { name: 'HTTP GET', path: null, service: 'app-web', statusCode: 200, traceID: 't1' },
  ]);

  expect(requests).toStrictEqual([{ route: 'app-web HTTP GET', traceID: 't1' }]);
});

test('it keeps a request that shares its window with health checks', () => {
  const requests = collectFleetRequests([
    { name: 'GET /health', path: null, service: 'app-web', statusCode: 200, traceID: 'health' },
    { name: 'GET /', path: null, service: 'app-web', statusCode: 200, traceID: 'page' },
  ]);

  expect(requests).toStrictEqual([{ route: 'GET /', traceID: 'page' }]);
});
