import { expect, test } from 'bun:test';
import { parseTraceparent } from './parse-traceparent';

test('it parses a well-formed traceparent header', () => {
  const header = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

  expect(parseTraceparent(header)).toStrictEqual({
    spanID: '00f067aa0ba902b7',
    traceID: '4bf92f3577b34da6a3ce929d0e0e4736',
  });
});

test('it tolerates surrounding whitespace', () => {
  const header = ' 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00 ';

  expect(parseTraceparent(header)?.traceID).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
});

test('it returns null for a missing header', () => {
  expect(parseTraceparent(null)).toBeNull();
});

test('it returns null for malformed input', () => {
  expect(parseTraceparent('not-a-traceparent')).toBeNull();
  expect(parseTraceparent('00-shorttrace-00f067aa0ba902b7-01')).toBeNull();
  expect(parseTraceparent('00-4BF92F3577B34DA6A3CE929D0E0E4736-00f067aa0ba902b7-01')).toBeNull();
});

test('it returns null for the forbidden version ff', () => {
  expect(parseTraceparent('ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')).toBeNull();
});

test('it returns null for all-zero trace or span ids', () => {
  expect(parseTraceparent('00-00000000000000000000000000000000-00f067aa0ba902b7-01')).toBeNull();
  expect(parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01')).toBeNull();
});
