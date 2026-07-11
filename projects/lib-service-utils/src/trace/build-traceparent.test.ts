import { expect, test } from 'bun:test';
import { buildTraceparent } from './build-traceparent';
import { parseTraceparent } from './parse-traceparent';

test('it serializes a trace context as a sampled version-00 header', () => {
  const header = buildTraceparent({
    spanID: '00f067aa0ba902b7',
    traceID: '4bf92f3577b34da6a3ce929d0e0e4736',
  });

  expect(header).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
});

test('it round-trips through parseTraceparent', () => {
  const trace = { spanID: 'abcdefabcdefabcd', traceID: 'abcdefabcdefabcdefabcdefabcdefab' };

  expect(parseTraceparent(buildTraceparent(trace))).toStrictEqual(trace);
});
