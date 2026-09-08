import { expect, test } from 'bun:test';
import { ZodError } from 'zod';
import { parseAxiomSpans } from './parse-axiom-spans';

test('it reads each match into a span, filling absent attributes with null', () => {
  const spans = parseAxiomSpans({
    format: 'legacy',
    matches: [
      {
        _time: '2026-09-07T16:53:16.796Z',
        data: {
          attributes: {
            http: { request: { method: null }, response: { status_code: 200 } },
            url: { path: null },
          },
          name: 'POST /api/rpc/activity/getActivityRewards',
          service: { name: 'app-web' },
          trace_id: 'dc0cb0bad860a9d8f9e46733e1402ed6',
        },
      },
      {
        _time: '2026-09-07T16:53:16.796Z',
        data: {
          attributes: {
            http: { request: { method: null }, response: { status_code: null } },
            url: { path: '/api/rpc/activity/getActivityRewards' },
          },
          name: 'HTTP POST',
          service: { name: 'app-web' },
          trace_id: 'dc0cb0bad860a9d8f9e46733e1402ed6',
        },
      },
      {
        data: {
          name: 'POST /rpc*',
          trace_id: '326e22fcd530cc5dbce940dfe00e2cdb',
        },
      },
    ],
  });

  expect(spans).toStrictEqual([
    {
      name: 'POST /api/rpc/activity/getActivityRewards',
      path: null,
      service: 'app-web',
      statusCode: 200,
      traceID: 'dc0cb0bad860a9d8f9e46733e1402ed6',
    },
    {
      name: 'HTTP POST',
      path: '/api/rpc/activity/getActivityRewards',
      service: 'app-web',
      statusCode: null,
      traceID: 'dc0cb0bad860a9d8f9e46733e1402ed6',
    },
    {
      name: 'POST /rpc*',
      path: null,
      service: 'unknown',
      statusCode: null,
      traceID: '326e22fcd530cc5dbce940dfe00e2cdb',
    },
  ]);
});

test('it reads an empty window as no spans', () => {
  expect(parseAxiomSpans({ format: 'legacy', matches: null })).toBeEmpty();
});

test('it rejects a match without a trace id', () => {
  expect(() =>
    parseAxiomSpans({ matches: [{ data: { name: 'GET /', service: { name: 'app-web' } } }] }),
  ).toThrowWithMessage(ZodError, /trace_id/);
});
