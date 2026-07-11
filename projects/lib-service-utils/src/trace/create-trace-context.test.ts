import { expect, test } from 'bun:test';
import { createTraceContext } from './create-trace-context';

test('it mints a fresh trace and span id without a parent', () => {
  const trace = createTraceContext();

  expect(trace.traceID).toMatch(/^[0-9a-f]{32}$/);
  expect(trace.spanID).toMatch(/^[0-9a-f]{16}$/);
});

test('it continues the parent trace id with a fresh span id', () => {
  const parent = createTraceContext();
  const child = createTraceContext(parent);

  expect(child.traceID).toBe(parent.traceID);
  expect(child.spanID).not.toBe(parent.spanID);
});
