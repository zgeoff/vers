import { expect, test } from 'bun:test';
import { getTraceStorage } from './get-trace-storage';

test('it returns the same storage instance across calls', () => {
  expect(getTraceStorage()).toBe(getTraceStorage());
});
