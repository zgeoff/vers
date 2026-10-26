import { expect, test } from 'bun:test';
import { parseArgs, resolveArgs } from 'gunshi';
import { QA_CAPTURE_ARGS } from './qa-capture-args';

test('it logs the RPC path of every shared worker when no flag narrows the capture', () => {
  const resolved = resolveArgs(QA_CAPTURE_ARGS, parseArgs([]));

  expect(resolved.error).toBeUndefined();
  expect({ ...resolved.values }).toStrictEqual({ path: '/api/rpc/' });
});

test('it reads the endpoint, the path filter and the worker url filter', () => {
  const resolved = resolveArgs(
    QA_CAPTURE_ARGS,
    parseArgs([
      '--endpoint',
      '127.0.0.1:9333',
      '--path',
      '/api/other/',
      '--worker-url',
      'example.test',
    ]),
  );

  expect({ ...resolved.values }).toStrictEqual({
    endpoint: '127.0.0.1:9333',
    path: '/api/other/',
    'worker-url': 'example.test',
  });
});

test('it rejects an endpoint flag that is not host:port', () => {
  const resolved = resolveArgs(QA_CAPTURE_ARGS, parseArgs(['--endpoint', '127.0.0.1']));

  expect(resolved.error?.errors).toPartiallyContain({
    message: expect.toInclude('expected host:port'),
  });
});
