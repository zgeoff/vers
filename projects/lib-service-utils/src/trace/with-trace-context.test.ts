import { expect, test } from 'bun:test';
import { findTraceContext } from './find-trace-context';
import { withTraceContext } from './with-trace-context';

test('it exposes the trace context across awaits inside the callback', async () => {
  const trace = { spanID: '00f067aa0ba902b7', traceID: '4bf92f3577b34da6a3ce929d0e0e4736' };

  const seen = await withTraceContext(trace, async () => {
    await Promise.resolve();

    return findTraceContext();
  });

  expect(seen).toStrictEqual(trace);
});

test('it finds no trace context outside a scope', () => {
  expect(findTraceContext()).toBeUndefined();
});

test('it scopes nested contexts to their own callbacks', () => {
  const outer = { spanID: 'aaaaaaaaaaaaaaaa', traceID: 'a'.repeat(32) };
  const inner = { spanID: 'bbbbbbbbbbbbbbbb', traceID: 'b'.repeat(32) };

  withTraceContext(outer, () => {
    withTraceContext(inner, () => {
      expect(findTraceContext()).toStrictEqual(inner);
    });

    expect(findTraceContext()).toStrictEqual(outer);
  });
});
